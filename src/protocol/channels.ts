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

import type { BrowserContextChannel, Channel, PageChannel, PlaywrightInitializer } from '@protocol/channels';
import type { Mode } from '@recorder/recorderTypes';
import type { CallMetadata } from 'playwright-core/lib/server/instrumentation';
import type { CrxBrowserContextOptions } from 'src/types/types';

export type CrxPlaywrightInitializer = PlaywrightInitializer & { _crx: CrxChannel };

// ----------- Crx -----------
export type CrxInitializer = {};
export interface CrxEventTarget {
}
export interface CrxChannel extends CrxEventTarget, Channel {
  _type_Crx: boolean;
  start(params: CrxStartParams, metadata?: CallMetadata): Promise<CrxStartResult>;
}
export type CrxStartParams = {
  slowMo?: number,
  artifactsDir?: string,
  downloadsPath?: string,
  tracesDir?: string,
  incognito?: boolean,
  deviceName?: string,
  contextOptions?: CrxBrowserContextOptions,
};
export type CrxStartOptions = {
  slowMo?: number,
  artifactsDir?: string,
  downloadsPath?: string,
  tracesDir?: string,
  incognito?: boolean,
  contextOptions?: CrxBrowserContextOptions,
};
export type CrxStartResult = {
  crxApplication: CrxApplicationChannel,
};

export interface CrxEvents {
}

// ----------- CrxApplication -----------
export type CrxApplicationInitializer = {
  context: BrowserContextChannel,
};
export interface CrxApplicationEventTarget {
  on(event: 'hide', callback: (params: CrxApplicationHideEvent) => void): this;
  on(event: 'show', callback: (params: CrxApplicationShowEvent) => void): this;
  on(event: 'attached', callback: (params: CrxApplicationAttachedEvent) => void): this;
  on(event: 'detached', callback: (params: CrxApplicationDetachedEvent) => void): this;
  on(event: 'modeChanged', callback: (params: CrxApplicationModeChangedEvent) => void): this;
}
export interface CrxApplicationChannel extends CrxApplicationEventTarget, Channel {
  _type_CrxApplication: boolean;
  attach(params: CrxApplicationAttachParams, metadata?: CallMetadata): Promise<CrxApplicationAttachResult>;
  attachAll(params: CrxApplicationAttachAllParams, metadata?: CallMetadata): Promise<CrxApplicationAttachAllResult>;
  detach(params: CrxApplicationDetachParams, metadata?: CallMetadata): Promise<CrxApplicationDetachResult>;
  detachAll(params?: CrxApplicationDetachAllParams, metadata?: CallMetadata): Promise<CrxApplicationDetachAllResult>;
  newPage(params: CrxApplicationNewPageParams, metadata?: CallMetadata): Promise<CrxApplicationNewPageResult>;
  showRecorder(params: CrxApplicationShowRecorderParams, metadata?: CallMetadata): Promise<CrxApplicationShowRecorderResult>;
  hideRecorder(params?: CrxApplicationHideRecorderParams, metadata?: CallMetadata): Promise<CrxApplicationHideRecorderResult>;
  setMode(params: CrxApplicationSetModeParams, metadata?: CallMetadata): Promise<CrxApplicationSetModeResult>;
  close(params?: CrxApplicationCloseParams, metadata?: CallMetadata): Promise<CrxApplicationCloseResult>;
  list(params?: CrxApplicationListParams, metadata?: CallMetadata): Promise<CrxApplicationListResult>;
  load(params?: CrxApplicationLoadParams, metadata?: CallMetadata): Promise<CrxApplicationLoadResult>;
  run(params?: CrxApplicationRunParams, metadata?: CallMetadata): Promise<CrxApplicationRunResult>;
}
export type CrxApplicationHideEvent = {};
export type CrxApplicationShowEvent = {};
export type CrxApplicationAttachedEvent = {
  page: PageChannel,
  tabId: number,
};
export type CrxApplicationDetachedEvent = {
  tabId: number,
};
export type CrxApplicationModeChangedEvent = {
  mode: 'none' | 'recording' | 'inspecting' | 'assertingText' | 'recording-inspecting' | 'standby' | 'assertingVisibility' | 'assertingValue' | 'assertingSnapshot',
};
export type CrxApplicationAttachParams = {
  tabId: number,
};
export type CrxApplicationAttachOptions = {

};
export type CrxApplicationAttachResult = {
  page: PageChannel,
};
export type CrxApplicationAttachAllParams = {
  status?: 'loading' | 'complete',
  lastFocusedWindow?: boolean,
  windowId?: number,
  windowType?: 'normal' | 'popup' | 'panel' | 'app' | 'devtools',
  active?: boolean,
  index?: number,
  title?: string,
  url?: string[],
  currentWindow?: boolean,
  highlighted?: boolean,
  discarded?: boolean,
  autoDiscardable?: boolean,
  pinned?: boolean,
  audible?: boolean,
  muted?: boolean,
  groupId?: number,
};
export type CrxApplicationAttachAllOptions = {
  status?: 'loading' | 'complete',
  lastFocusedWindow?: boolean,
  windowId?: number,
  windowType?: 'normal' | 'popup' | 'panel' | 'app' | 'devtools',
  active?: boolean,
  index?: number,
  title?: string,
  url?: string[],
  currentWindow?: boolean,
  highlighted?: boolean,
  discarded?: boolean,
  autoDiscardable?: boolean,
  pinned?: boolean,
  audible?: boolean,
  muted?: boolean,
  groupId?: number,
};
export type CrxApplicationAttachAllResult = {
  pages: PageChannel[],
};
export type CrxApplicationDetachParams = {
  tabId?: number,
  page?: PageChannel,
};
export type CrxApplicationDetachOptions = {
  tabId?: number,
  page?: PageChannel,
};
export type CrxApplicationDetachResult = void;
export type CrxApplicationDetachAllParams = {};
export type CrxApplicationDetachAllOptions = {};
export type CrxApplicationDetachAllResult = void;
export type CrxApplicationNewPageParams = {
  index?: number,
  openerTabId?: number,
  url?: string,
  pinned?: boolean,
  windowId?: number,
  active?: boolean,
  selected?: boolean,
};
export type CrxApplicationNewPageOptions = {
  index?: number,
  openerTabId?: number,
  url?: string,
  pinned?: boolean,
  windowId?: number,
  active?: boolean,
  selected?: boolean,
};
export type CrxApplicationNewPageResult = {
  page: PageChannel,
};
export type CrxApplicationShowRecorderParams = {
  mode?: 'none' | 'recording' | 'inspecting',
  language?: string,
  testIdAttributeName?: string,
  playInIncognito?: boolean,
  window?: {
    type?: 'popup' | 'sidepanel',
    url?: string,
  },
};
export type CrxApplicationShowRecorderOptions = {
  mode?: 'none' | 'recording' | 'inspecting',
  language?: string,
  testIdAttributeName?: string,
  playInIncognito?: boolean,
  window?: {
    type?: 'popup' | 'sidepanel',
    url?: string,
  },
};
export type CrxApplicationShowRecorderResult = void;
export type CrxApplicationHideRecorderParams = {};
export type CrxApplicationHideRecorderOptions = {};
export type CrxApplicationHideRecorderResult = void;
export type CrxApplicationSetModeParams = {
  mode: Mode
};
export type CrxApplicationSetModeOptions = {
  mode: Mode
};
export type CrxApplicationSetModeResult = void;
export type CrxApplicationCloseParams = {};
export type CrxApplicationCloseOptions = {};
export type CrxApplicationCloseResult = void;
export type CrxApplicationListParams = { code: string };
export type CrxApplicationListOptions = { code: string };
export type CrxApplicationListResult = {
  tests: {
    title: string,
    options?: {
      deviceName?: string,
      contextOptions?: CrxBrowserContextOptions,
    },
    location?: {
      file: string,
      line?: number,
      column?: number,
    },
  }[]
};
export type CrxApplicationLoadParams = { code: string };
export type CrxApplicationLoadOptions = { code: string };
export type CrxApplicationLoadResult = void;
export type CrxApplicationRunParams = { page?: PageChannel, code: string };
export type CrxApplicationRunOptions = { page?: PageChannel, code: string};
export type CrxApplicationRunResult = void;

export interface CrxApplicationEvents {
  'hide': CrxApplicationHideEvent;
  'show': CrxApplicationShowEvent;
  'attached': CrxApplicationAttachedEvent;
  'detached': CrxApplicationDetachedEvent;
  'modeChanged': CrxApplicationModeChangedEvent;
}
