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

import type { PlaywrightDispatcher } from 'playwright-core/lib/server';
import { DispatcherConnection, RootDispatcher } from 'playwright-core/lib/server';
import { CrxConnection } from './client/crxConnection';
import type { CrxPlaywright as CrxPlaywrightAPI } from './client/crxPlaywright';
import { CrxPlaywright } from './server/crxPlaywright';
import { CrxPlaywrightDispatcher } from './server/dispatchers/crxPlaywrightDispatcher';
import { PageBinding } from 'playwright-core/lib/server/page';
import { wrapClientApis } from './client/crxZone';
import type { RootInitializeParams } from '@protocol/channels';

export { debug as _debug } from 'debug';
export { setUnderTest as _setUnderTest, isUnderTest as _isUnderTest } from 'playwright-core/lib/utils';

// avoid conflicts with playwright when testing
PageBinding.kPlaywrightBinding = '__crx__binding__';

function getCurrentTime(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// 本地模式相关变量
let playwright: CrxPlaywright | null = null;
let clientConnection: CrxConnection | null = null;
let dispatcherConnection: DispatcherConnection | null = null;
let rootScope: RootDispatcher | null = null;
let localPlaywrightAPI: CrxPlaywrightAPI | null = null;

// 初始化本地模式
function initializeLocalMode(): CrxPlaywrightAPI {
  if (localPlaywrightAPI)
    return localPlaywrightAPI;

  playwright = new CrxPlaywright();
  clientConnection = new CrxConnection();
  dispatcherConnection = new DispatcherConnection(true /* local */);

  // Dispatch synchronously at first.
  dispatcherConnection.onmessage = message => clientConnection!.dispatch(message);
  clientConnection.onmessage = message => dispatcherConnection!.dispatch(message);

  rootScope = new RootDispatcher(dispatcherConnection);

  // Initialize Playwright channel.
  new CrxPlaywrightDispatcher(rootScope, playwright);
  localPlaywrightAPI = clientConnection.getObjectWithKnownName('Playwright') as CrxPlaywrightAPI;

  // Switch to async dispatch after we got Playwright object.
  dispatcherConnection.onmessage = message => {
    console.log('dispatcherConnection received then clientConnection dispath message:', message);
    setImmediate(() => clientConnection!.dispatch(message));
  };
  clientConnection.onmessage = message => {
    console.log('clientConnection received then dispatcherConnection dispath message:', message);
    setImmediate(() => dispatcherConnection!.dispatch(message));
  };

  clientConnection.toImpl = (x: any) => x ? dispatcherConnection!._dispatchers.get(x._guid)!._object : dispatcherConnection!._dispatchers.get('');
  (localPlaywrightAPI as any)._toImpl = clientConnection.toImpl;

  return localPlaywrightAPI;
}

// 清理本地模式
function cleanupLocalMode() {
  playwright = null;
  clientConnection = null;
  dispatcherConnection = null;
  rootScope = null;
  localPlaywrightAPI = null;
}

// WebSocket 客户端实现
class PlaywrightWebSocketClient {
  private ws: WebSocket;
  private dispatcherConnection: DispatcherConnection;
  private rootDispatcher: RootDispatcher;
  private playwright: CrxPlaywright;
  private initialized = false;
  private onDisconnectCallback?: () => void;

  constructor(wsUrl: string = 'ws://localhost:8000/ws/playwright', onDisconnect?: () => void) {
    this.ws = new WebSocket(wsUrl);
    this.onDisconnectCallback = onDisconnect;
    this.playwright = new CrxPlaywright();
    this.dispatcherConnection = new DispatcherConnection(true /* local */);
    this.rootDispatcher = new RootDispatcher(this.dispatcherConnection, async (rootScope: RootDispatcher, options: RootInitializeParams) => {
      const dispatcher = new CrxPlaywrightDispatcher(rootScope, this.playwright);
      return dispatcher as PlaywrightDispatcher;
    });
    // 设置消息处理
    this.dispatcherConnection.onmessage = message => {
      console.log(`[${getCurrentTime()}] Sending message to websocket server:`, message);
      if (this.ws.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify(message));
      else
        console.error(`[${getCurrentTime()}] WebSocket not ready(readyState: ${this.ws.readyState}), message dropped:`, message);
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => {
        console.log(`[${getCurrentTime()}] Connected to websocket server`);
        resolve();
      });

      this.ws.addEventListener('message', async (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data.toString());
          console.log(`[${getCurrentTime()}] Received message from websocket server:`, message);

          // 如果是 __create__ 消息，先处理它
          if (message.method === 'initialize' && !this.initialized) {
            try {
              await this.dispatcherConnection.dispatch(message);
              this.initialized = true;
            } catch (error) {
              reject(error);
            }
          } else {
            // 处理其他消息
            await this.dispatcherConnection.dispatch(message);
          }
        } catch (error) {
          console.error(`[${getCurrentTime()}] Error processing message:`, error);
          if (!this.initialized)
            reject(error);
        }
      });

      this.ws.addEventListener('error', (event: Event) => {
        const error = new Error('WebSocket error occurred');
        console.error(`[${getCurrentTime()}] WebSocket error:`, error);
        reject(error);
      });

      this.ws.addEventListener('close', () => {
        console.log(`[${getCurrentTime()}] Disconnected from websocket server`);
        this.cleanup();
        if (this.onDisconnectCallback)
          this.onDisconnectCallback();

        if (!this.initialized)
          reject(new Error('Connection closed before initialization'));
      });
    });
  }

  async cleanup(): Promise<void> {
    try {
      if (this.ws.readyState === WebSocket.OPEN)
        this.ws.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// 导出 WebSocket 客户端相关函数
let wsClient: PlaywrightWebSocketClient | null = null;

// disconnect and reset the client
export async function disconnectFromPlaywrightServer(): Promise<void> {
  if (wsClient) {
    await wsClient.cleanup();
    wsClient = null;
    console.log(`[${getCurrentTime()}] Playwright WebSocket client disconnected`);
  }
}

export async function connectToPlaywrightServer(wsUrl: string, onDisconnect?: () => void): Promise<void> {
  await disconnectFromPlaywrightServer();

  wsClient = new PlaywrightWebSocketClient(wsUrl, onDisconnect);
  try {
    await wsClient.connect();
    console.log(`[${getCurrentTime()}] Playwright WebSocket client is running...`);
  } catch (error) {
    console.error(`[${getCurrentTime()}] Failed to start client:`, error);
    wsClient = null; // Make sure to reset on error
    throw error;
  }
}

// 导出可空的 API
export let crx: CrxPlaywrightAPI['_crx'] | null = null;
export let selectors: CrxPlaywrightAPI['selectors'] | null = null;
export let errors: CrxPlaywrightAPI['errors'] | null = null;
export let default_api: CrxPlaywrightAPI | null = null;

// 监听模式切换
export function setWebSocketMode(enabled: boolean) {
  if (!enabled) {
    // 切换到本地模式
    const api = initializeLocalMode();
    ({ _crx: crx, selectors, errors } = api);
    default_api = api;
  } else {
    // 切换到 WebSocket 模式，清空本地 API
    cleanupLocalMode();
    crx = null;
    selectors = null;
    errors = null;
    default_api = null;
  }
}

wrapClientApis();
