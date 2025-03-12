#!/usr/bin/env node

/**
 * 自定义构建脚本，用于生成纯 JavaScript 文件
 * 不包含类型定义文件，不混淆，不压缩
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 运行标准构建
console.log('正在构建 JavaScript 文件...');
execSync('npm run build:crx', { stdio: 'inherit' });

// 创建输出目录
const outputDir = path.join(__dirname, 'dist-js-only');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 复制 JavaScript 文件到输出目录
console.log('正在复制 JavaScript 文件到输出目录...');
const libDir = path.join(__dirname, 'lib');
const files = fs.readdirSync(libDir);

// 只复制 .js 和 .mjs 文件，不复制 .map 文件和其他类型定义文件
files.forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.mjs')) {
    const srcPath = path.join(libDir, file);
    const destPath = path.join(outputDir, file);
    fs.copyFileSync(srcPath, destPath);
  }
});

console.log(`构建完成！JavaScript 文件已复制到 ${outputDir} 目录`);
console.log('您可以直接将此目录中的文件复制到您的项目中使用');
