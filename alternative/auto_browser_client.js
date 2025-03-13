const WebSocket = require('ws');
const { DispatcherConnection, RootDispatcher, PlaywrightDispatcher } = require('playwright-core/lib/server');
const { createPlaywright } = require('playwright-core/lib/server');

class PlaywrightDriver {
  constructor() {
    this.ws = new WebSocket('ws://localhost:8000/ws/playwright');
    this.dispatcherConnection = new DispatcherConnection();
    this.initialized = false;

    // 创建 root dispatcher
    this.rootDispatcher = new RootDispatcher(this.dispatcherConnection, async (rootScope, { sdkLanguage }) => {
      const playwright = createPlaywright({ sdkLanguage });
      return new PlaywrightDispatcher(rootScope, playwright);
    });

    // 设置消息处理
    this.dispatcherConnection.onmessage = message => {
      console.log('Sending message to Python:', message);
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        console.error('WebSocket not ready, message dropped:', message);
      }
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      let createMessagesReceived = 0;
      const requiredCreateMessages = 2; // 等待两个 __create__ 消息

      this.ws.on('open', () => {
        console.log('Connected to Python controller');
      });

      this.ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received message from Python:', message);

          // 如果是 __create__ 消息，先处理它
          if (message.method === '__create__') {
            createMessagesReceived++;
            this.dispatcherConnection.dispatch(message);

            // 当收到所需的 __create__ 消息后，执行初始化
            if (createMessagesReceived === requiredCreateMessages && !this.initialized) {
              this.initialized = true;
              try {
                this.rootDispatcher.initialize({ sdkLanguage: 'python' });
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          } else {
            // 处理其他消息
            this.dispatcherConnection.dispatch(message);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Disconnected from Python controller');
        this.cleanup();
      });
    });
  }

  async cleanup() {
    try {
      await this.dispatcherConnection.cleanup();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

async function main() {
  const driver = new PlaywrightDriver();

  try {
    await driver.connect();
    console.log('Playwright WebSocket driver is running...');

    process.on('SIGINT', async () => {
      console.log('Received SIGINT. Cleaning up...');
      await driver.cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start driver:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
