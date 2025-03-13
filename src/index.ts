/**
 * Copyright (c) Rui Figueira.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import './shims/global';
import './protocol/validator';

import { DispatcherConnection, RootDispatcher } from 'playwright-core/lib/server';
import type { CrxPlaywright as CrxPlaywrightAPI } from './client/crxPlaywright';
import { CrxPlaywright } from './server/crxPlaywright';
import { CrxPlaywrightDispatcher } from './server/dispatchers/crxPlaywrightDispatcher';
import { PageBinding } from 'playwright-core/lib/server/page';
import { wrapClientApis } from './client/crxZone';
import type { Connection } from 'playwright-core/lib/client/connection';

export { debug as _debug } from 'debug';
export { setUnderTest as _setUnderTest, isUnderTest as _isUnderTest } from 'playwright-core/lib/utils';

// avoid conflicts with playwright when testing
PageBinding.kPlaywrightBinding = '__crx__binding__';

function getCurrentTime(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 月份从0开始
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

class PlaywrightWebSocketClient {
  private ws: WebSocket;
  private dispatcherConnection: DispatcherConnection;
  private rootDispatcher: RootDispatcher;
  private playwright: CrxPlaywright;
  private playwrightAPI: CrxPlaywrightAPI | null = null;
  private initialized = false;

  constructor(wsUrl: string = 'ws://localhost:8000/ws/playwright') {
    // 使用浏览器原生WebSocket
    this.ws = new WebSocket(wsUrl);
    this.playwright = new CrxPlaywright();
    this.dispatcherConnection = new DispatcherConnection(true /* local */);
    this.rootDispatcher = new RootDispatcher(this.dispatcherConnection);

    // 设置消息处理 - 从本地发送到服务器
    this.dispatcherConnection.onmessage = message => {
      console.log(`[${getCurrentTime()}]` + 'Sending message to server:', message);
      if (this.ws.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify(message));
      else
        console.error(`[${getCurrentTime()}]` + 'WebSocket not ready, message dropped:', message);
    };
  }

  async connect(): Promise<CrxPlaywrightAPI> {
    return new Promise((resolve, reject) => {
      let createMessagesReceived = 0;
      const requiredCreateMessages = 2; // 等待两个 __create__ 消息

      this.ws.addEventListener('open', () => {
        console.log('Connected to server');
      });

      this.ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data.toString());
          console.log(`[${getCurrentTime()}] Received message from server:`, message);

          // 如果是 __create__ 消息，先处理它
          if (message.method === 'initialize') {
            // 初始化Playwright channel
            new CrxPlaywrightDispatcher(this.rootDispatcher, this.playwright);
            createMessagesReceived++;
            this.dispatcherConnection.dispatch(message);

            // 当收到所需的 __create__ 消息后，执行初始化
            if (createMessagesReceived === requiredCreateMessages && !this.initialized) {
              this.initialized = true;
              try {
                this.rootDispatcher.initialize({ sdkLanguage: 'python' });
                this.playwrightAPI = this.getPlaywrightAPI();
                resolve(this.playwrightAPI);
              } catch (error) {
                reject(error);
              }
            }
          } else {
            // 处理其他消息
            this.dispatcherConnection.dispatch(message);
          }
        } catch (error) {
          console.error(`[${getCurrentTime()}] Error processing message:`, error);
        }
      });

      this.ws.addEventListener('error', (event: Event) => {
        const error = new Error('WebSocket error occurred');
        console.error(`[${getCurrentTime()}] WebSocket error:`, error);
        reject(error);
      });

      this.ws.addEventListener('close', () => {
        console.log(`[${getCurrentTime()}] Disconnected from server`);
        this.cleanup();
      });
    });
  }

  private getPlaywrightAPI(): CrxPlaywrightAPI {
    // 尝试获取Playwright对象
    // 使用Connection的方法获取对象
    const connection = this.dispatcherConnection as unknown as Connection;
    const api = connection._objects.get('Playwright') as CrxPlaywrightAPI;
    if (!api)
      throw new Error('Playwright API not ready yet');

    // 设置toImpl方法
    (api as any)._toImpl = (x: any) => {
      if (x)
        return this.dispatcherConnection._dispatchers.get(x._guid)!._object;
      else
        return this.dispatcherConnection._dispatchers.get('');
    };

    return api;
  }

  async cleanup(): Promise<void> {
    try {
      // 手动清理资源
      if (this.ws.readyState === WebSocket.OPEN)
        this.ws.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// 创建客户端实例
const client = new PlaywrightWebSocketClient();

// 导出API
let playwrightAPI: CrxPlaywrightAPI | null = null;

// 连接到服务器并获取API
client.connect().then(api => {
  playwrightAPI = api;
  console.log(`[${getCurrentTime()}]` + 'Playwright WebSocket client is running...');

  // 处理进程退出（仅在Node.js环境中有效）
  if (typeof process !== 'undefined' && process.on) {
    process.on('SIGINT', async () => {
      console.log(`[${getCurrentTime()}]` + 'Received SIGINT. Cleaning up...');
      await client.cleanup();
      process.exit(0);
    });
  }
}).catch(error => {
  console.error(`[${getCurrentTime()}] Failed to start client:`, error);
  // 仅在Node.js环境中退出进程
  if (typeof process !== 'undefined' && process.exit)
    process.exit(1);

});

// 使用可选链操作符避免在playwrightAPI为null时出错
export const { _crx: crx, selectors, errors } = playwrightAPI || {} as CrxPlaywrightAPI;
export default playwrightAPI;

wrapClientApis();
