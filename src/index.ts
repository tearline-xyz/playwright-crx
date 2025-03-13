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
  private crxPlaywrightDispatcher: CrxPlaywrightDispatcher | null = null;

  constructor(wsUrl: string = 'ws://localhost:8000/ws/playwright') {
    this.ws = new WebSocket(wsUrl);
    this.playwright = new CrxPlaywright();
    this.dispatcherConnection = new DispatcherConnection(true /* local */);
    this.rootDispatcher = new RootDispatcher(this.dispatcherConnection);

    // 设置消息处理
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
      this.ws.addEventListener('open', () => {
        console.log('Connected to server');
      });

      this.ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data.toString());
          console.log(`[${getCurrentTime()}] Received message from server:`, message);

          // 如果是 initialize 消息，创建 CrxPlaywrightDispatcher
          if (message.method === 'initialize' && !this.initialized) {
            try {
              this.crxPlaywrightDispatcher = new CrxPlaywrightDispatcher(this.rootDispatcher, this.playwright);
              this.initialized = true;
            } catch (error) {
              reject(error);
              return;
            }
          }

          // 分发消息
          this.dispatcherConnection.dispatch(message);

          // 如果收到 initialize 消息的响应（没有错误），说明初始化成功
          if (message.id === 1 && !message.error && this.initialized) {
            try {
              this.playwrightAPI = this.getPlaywrightAPI();
              if (this.playwrightAPI)
                resolve(this.playwrightAPI);
              else
                reject(new Error('Failed to get Playwright API'));
            } catch (error) {
              reject(error);
            }
          } else if (message.error) {
            reject(new Error(`Server error: ${message.error.error.message}`));
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
        console.log(`[${getCurrentTime()}] Disconnected from server`);
        this.cleanup();
        if (!this.initialized)
          reject(new Error('Connection closed before initialization'));
      });
    });
  }

  private getPlaywrightAPI(): CrxPlaywrightAPI {
    // 尝试获取Playwright对象
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
      if (this.ws.readyState === WebSocket.OPEN)
        this.ws.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// 导出API
let playwrightAPI: CrxPlaywrightAPI | null = null;
let client: PlaywrightWebSocketClient | null = null;

// 导出连接函数
export async function connectToPlaywrightServer(wsUrl: string): Promise<CrxPlaywrightAPI> {
  if (playwrightAPI)
    return playwrightAPI;

  client = new PlaywrightWebSocketClient(wsUrl);
  try {
    playwrightAPI = await client.connect();
    console.log(`[${getCurrentTime()}]` + 'Playwright WebSocket client is running...');
    return playwrightAPI;
  } catch (error) {
    console.error(`[${getCurrentTime()}] Failed to start client:`, error);
    throw error;
  }
}

// 导出清理函数
export async function disconnectFromPlaywrightServer(): Promise<void> {
  if (client) {
    await client.cleanup();
    client = null;
  }
  playwrightAPI = null;
}

// 使用可选链操作符避免在playwrightAPI为null时出错
export const { _crx: crx, selectors, errors } = {} as CrxPlaywrightAPI;
export default null;

wrapClientApis();
