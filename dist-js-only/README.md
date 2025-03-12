# playwright-crx JavaScript 文件

这个目录包含了 playwright-crx 的纯 JavaScript 文件，没有类型定义文件，没有被混淆或压缩。您可以直接将这些文件复制到您的项目中使用。

## 文件说明

- `index.js` / `index.mjs`: 主入口文件，CommonJS 和 ES Module 格式
- `test.js` / `test.mjs`: 测试相关功能的入口文件，包含 `expect` 断言库
- `index-BTSEn_dr.js` / `index-CE4WjMXt.mjs`: 主要实现文件

## 在项目中使用

### 方法 1: 直接复制文件

将这个目录中的所有文件复制到您项目的某个目录中，例如 `vendor/playwright-crx`，然后在您的代码中引用：

```javascript
// CommonJS 格式
const { crx } = require('./vendor/playwright-crx/index.js');

// 或者 ES Module 格式
import { crx } from './vendor/playwright-crx/index.mjs';
```

### 方法 2: 作为本地依赖

1. 将这个目录复制到您项目的某个位置
2. 在您的 `package.json` 中添加本地依赖：

```json
{
  "dependencies": {
    "playwright-crx": "file:./path/to/dist-js-only"
  }
}
```

3. 运行 `npm install` 或 `yarn` 安装依赖
4. 在代码中使用：

```javascript
// CommonJS 格式
const { crx } = require('playwright-crx');

// 或者 ES Module 格式
import { crx } from 'playwright-crx';
```

## 修改代码

由于这些文件没有被混淆或压缩，您可以直接修改它们以满足您的需求。主要的实现代码在 `index-BTSEn_dr.js` 和 `index-CE4WjMXt.mjs` 文件中。

## 注意事项

- 这些文件依赖于 Chrome 扩展 API，只能在 Chrome 扩展环境中使用
- 如果您修改了代码，请确保测试您的修改是否正常工作
