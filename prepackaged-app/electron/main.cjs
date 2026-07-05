// @ts-nocheck
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 引入工具模块
const { safeLog, safeError, setAppClosing: setLoggerAppClosing } = require('./utils/logger');
const { safeSetTimeout, clearAllTimers, setAppClosing: setTimersAppClosing } = require('./utils/timers');
const { getProjectRoot, initializeAppData } = require('./utils/paths');
const backendService = require('./services/backend');
const authService = require('./services/auth');
const { exchangeCodeForToken } = require('./services/auth');
const windowService = require('./services/window');

// 尝试加载 puppeteer-core（用于 Puppeteer 登录）
let puppeteer = null;
try {
  puppeteer = require('puppeteer-core');
  console.log('✅ Puppeteer-core 已加载');
} catch (error) {
  console.warn('⚠️  Puppeteer-core 未安装，将使用 BrowserWindow 登录方案');
  console.warn('   如需使用 Puppeteer 登录，请运行: cd webui-frontend && npm install puppeteer-core');
}

// 尝试加载 pixiv-token-getter（优先使用）
let pixivTokenGetter = null;
try {
  pixivTokenGetter = require('pixiv-token-getter');
  // 尝试加载适配器（如果可用）
  try {
    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(__dirname, '../../dist/pixiv-token-getter-adapter.js'), // 开发模式：从 electron 目录
      path.join(process.cwd(), 'dist/pixiv-token-getter-adapter.js'), // 从项目根目录
      path.join(process.resourcesPath || '', 'dist/pixiv-token-getter-adapter.js'), // 生产模式
    ];
    
    let adapterPath = null;
    for (const possiblePath of possiblePaths) {
      if (possiblePath && fs.existsSync(possiblePath)) {
        adapterPath = possiblePath;
        break;
      }
    }
    
    if (adapterPath) {
      require(adapterPath);
      console.log('✅ pixiv-token-getter 适配器已加载:', adapterPath);
    } else {
      console.log('✅ pixiv-token-getter 已加载（直接使用，未找到适配器）');
    }
  } catch (adapterError) {
    console.log('✅ pixiv-token-getter 已加载（直接使用，适配器加载失败）');
    console.log('   适配器错误:', adapterError.message);
  }
} catch (error) {
  console.warn('⚠️  pixiv-token-getter 未安装，将使用 Puppeteer 或 BrowserWindow 登录方案');
  console.warn('   如需使用 pixiv-token-getter 登录，请运行: npm install pixiv-token-getter');
}

let mainWindow = null;
let isAppClosing = false; // 应用是否正在关闭
let appData = null; // 应用数据目录信息（生产模式下）

// 认证和窗口管理已移至服务模块
// - 登录相关: authService
// - 窗口管理: windowService

// 全局错误处理 - 防止应用闪退
// 必须在应用初始化之前设置，以便捕获所有错误
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  console.error('错误堆栈:', error.stack);
  
  // 将错误写入日志文件
  try {
    // 使用 try-catch 确保即使 app 未初始化也能记录错误
    let userDataPath;
    try {
      userDataPath = app.getPath('userData');
    } catch (e) {
      // 如果 app 未初始化，使用临时目录
      userDataPath = require('os').tmpdir();
    }
    
    const logDir = path.join(userDataPath, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, `crash-${Date.now()}.log`);
    fs.writeFileSync(logFile, `未捕获的异常: ${error.message}\n\n堆栈:\n${error.stack}\n`, 'utf8');
    console.error(`错误日志已保存到: ${logFile}`);
  } catch (logError) {
    console.error('无法写入错误日志:', logError);
    // 至少输出到控制台
    console.error('原始错误:', error);
  }
  
  // 显示错误对话框（仅在生产模式下且窗口已创建）
  try {
    if (!isDev && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox('应用错误', `发生未预期的错误:\n\n${error.message}\n\n错误日志已保存到应用数据目录的 logs 文件夹。`);
    }
  } catch (e) {
    // 忽略对话框错误
  }
  
  // 不要立即退出，尝试继续运行
  // 只有在严重错误时才退出
  if (error.message && (error.message.includes('ENOENT') || error.message.includes('Cannot find module'))) {
    console.error('文件或模块不存在错误，尝试继续运行...');
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  if (reason instanceof Error) {
    console.error('错误堆栈:', reason.stack);
  }
  
  // 将错误写入日志文件
  try {
    const userDataPath = app.getPath('userData');
    const logDir = path.join(userDataPath, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, `rejection-${Date.now()}.log`);
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : '';
    fs.writeFileSync(logFile, `未处理的 Promise 拒绝: ${errorMessage}\n\n堆栈:\n${errorStack}\n`, 'utf8');
    console.error(`错误日志已保存到: ${logFile}`);
  } catch (logError) {
    console.error('无法写入错误日志:', logError);
  }
});

// 处理 stdout/stderr 的 EPIPE 错误
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // 忽略 EPIPE 错误（流已关闭）
    return;
  }
});

process.stderr.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // 忽略 EPIPE 错误（流已关闭）
    return;
  }
});

// 工具函数已移至模块，这里保留注释以便理解代码结构
// - findProcessUsingPort, killProcess, cleanupPort -> utils/port.js
// - checkBackendReady, notifyBackendReady, checkAndSendPendingReadyNotification -> services/backend.js
// - startBackend, stopBackend -> services/backend.js

// 以下函数已移至模块，保留注释以便理解代码结构
/*
// 查找占用指定端口的进程（跨平台）
function findProcessUsingPort(port, callback) {
  const { exec } = require('child_process');
  
  if (process.platform === 'win32') {
    // Windows: 使用 netstat
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (error) {
        callback(null);
        return;
      }
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        }
      }
      callback(Array.from(pids));
    });
  } else {
    // macOS/Linux: 使用 lsof，尝试多种方法
    // 方法1: 使用 -ti 选项（最快）
    exec(`lsof -ti :${port}`, { timeout: 5000 }, (error1, stdout1) => {
      if (!error1 && stdout1 && stdout1.trim()) {
        const pids = stdout1.trim().split('\n').filter(pid => pid && pid.trim() && !isNaN(parseInt(pid)));
        if (pids.length > 0) {
          safeLog(`🔍 找到占用端口 ${port} 的进程: ${pids.join(', ')}`);
          callback(pids);
          return;
        }
      }
      
      // 方法2: 使用 -i 选项获取详细信息（如果方法1失败）
      exec(`lsof -i :${port}`, { timeout: 5000 }, (error2, stdout2) => {
        if (!error2 && stdout2 && stdout2.trim()) {
          const lines = stdout2.trim().split('\n').slice(1); // 跳过标题行
          const pids = new Set();
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              const pid = parts[1];
              if (pid && !isNaN(parseInt(pid))) {
                pids.add(pid);
              }
            }
          }
          if (pids.size > 0) {
            const pidArray = Array.from(pids);
            safeLog(`🔍 找到占用端口 ${port} 的进程: ${pidArray.join(', ')}`);
            callback(pidArray);
            return;
          }
        }
        
        // 如果都失败了，返回 null
        callback(null);
      });
    });
  }
}

// 杀死指定PID的进程
function killProcess(pid, callback) {
  const { exec } = require('child_process');
  
  if (process.platform === 'win32') {
    exec(`taskkill /PID ${pid} /F`, (error) => {
      callback(!error);
    });
  } else {
    exec(`kill -9 ${pid}`, (error) => {
      callback(!error);
    });
  }
}

// 清理占用端口的进程
async function cleanupPort(port) {
  return new Promise((resolve) => {
    checkPortInUse(port, (inUse) => {
      if (!inUse) {
        safeLog(`✅ 端口 ${port} 可用`);
        resolve(true);
        return;
      }
      
      safeLog(`⚠️  端口 ${port} 被占用，正在查找占用进程...`);
      findProcessUsingPort(port, (pids) => {
        if (!pids || pids.length === 0) {
          safeLog(`⚠️  无法找到占用端口 ${port} 的进程`);
          resolve(false);
          return;
        }
        
        safeLog(`🔍 找到 ${pids.length} 个占用端口的进程: ${pids.join(', ')}`);
        
        // 杀死所有占用端口的进程
        let killedCount = 0;
        const totalPids = pids.length;
        
        for (const pid of pids) {
          // 跳过当前进程和父进程
          if (pid === process.pid.toString() || pid === process.ppid?.toString()) {
            safeLog(`⚠️  跳过当前进程 PID: ${pid}`);
            killedCount++;
            if (killedCount === totalPids) {
              checkPortInUse(port, (stillInUse) => {
                resolve(!stillInUse);
              });
            }
            continue;
          }
          
          killProcess(pid, (success) => {
            if (success) {
              safeLog(`✅ 已终止进程 PID: ${pid}`);
            } else {
              safeLog(`⚠️  无法终止进程 PID: ${pid}`);
            }
            
            killedCount++;
            if (killedCount === totalPids) {
              // 等待一小段时间，让系统释放端口
              safeSetTimeout(() => {
                checkPortInUse(port, (stillInUse) => {
                  if (!stillInUse) {
                    safeLog(`✅ 端口 ${port} 已释放`);
                  } else {
                    safeLog(`⚠️  端口 ${port} 仍被占用`);
                  }
                  resolve(!stillInUse);
                });
              }, 1000);
            }
          });
        }
      });
    });
  });
}

// 检查后端是否已启动
function checkBackendReady(callback) {
  const http = require('http');
  const req = http.get(`http://localhost:${actualBackendPort}/api/health`, { timeout: 3000 }, (res) => {
    if (res.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
    res.on('data', () => {}); // 消费响应数据
    res.on('end', () => {});
  });
  req.on('error', () => callback(false));
  req.on('timeout', () => {
    req.destroy();
    callback(false);
  });
}

// 通知窗口后端已就绪（改进版：确保窗口准备好后才发送）
function notifyBackendReady() {
  backendReadyState = true; // 标记后端已就绪
  
  if (!mainWindow || isAppClosing) {
    safeLog('⚠️  窗口未准备好，缓存后端就绪状态');
    backendReadyNotificationPending = true;
    return;
  }
  
  // 检查窗口是否已经加载完成
  const webContents = mainWindow.webContents;
  if (!webContents || webContents.isDestroyed()) {
    safeLog('⚠️  窗口内容未准备好，缓存后端就绪状态');
    backendReadyNotificationPending = true;
    return;
  }
  
  // 尝试发送消息，如果失败则重试
  const sendReadyMessage = (attempt = 1) => {
    if (!mainWindow || isAppClosing || webContents.isDestroyed()) {
      return;
    }
    
    try {
      safeLog(`✅ 后端服务器已就绪，通知窗口 (尝试 ${attempt})`);
      webContents.send('backend-ready');
      backendReadyNotificationPending = false;
      
      // 额外发送一次，确保消息不丢失（延迟100ms）
      safeSetTimeout(() => {
        if (mainWindow && !isAppClosing && !webContents.isDestroyed()) {
          try {
            webContents.send('backend-ready');
          } catch (e) {
            // 忽略错误
          }
        }
      }, 100);
    } catch (error) {
      safeError('❌ 发送后端就绪消息失败:', error);
      if (attempt < 5) {
        // 重试，最多5次
        safeSetTimeout(() => sendReadyMessage(attempt + 1), 200);
      } else {
        backendReadyNotificationPending = true;
      }
    }
  };
  
  sendReadyMessage();
}

// 检查并发送待处理的后端就绪通知
function checkAndSendPendingReadyNotification() {
  if (backendReadyState && backendReadyNotificationPending && mainWindow && !isAppClosing) {
    const webContents = mainWindow.webContents;
    if (webContents && !webContents.isDestroyed()) {
      safeLog('📤 发送待处理的后端就绪通知');
      notifyBackendReady();
    }
  }
}
*/

// 初始化 backendService
backendService.setMainWindow(null); // 将在 createWindow 后设置

// 启动后端服务器 - 使用 backendService
async function startBackend() {
  return backendService.startBackend();
}

// 停止后端服务器 - 使用 backendService
async function stopBackend() {
  return backendService.stopBackend();
}

// 以下为旧的 startBackend 实现，已移至 services/backend.js
/*
async function startBackend_OLD() {
  // 如果正在启动中，跳过
  if (isBackendStarting) {
    safeLog('⚠️  后端正在启动中，跳过重复启动');
    return;
  }
  
  // 如果后端进程已存在，先停止它
  if (backendProcess) {
    safeLog('⚠️  后端进程已存在，先停止现有进程...');
    await stopBackend();
    // 等待进程完全退出
    await new Promise(resolve => safeSetTimeout(resolve, 1000));
  }
  
  // 检查重启次数限制
  if (backendRestartCount >= MAX_BACKEND_RESTARTS) {
    safeError(`❌ 后端重启次数已达上限 (${MAX_BACKEND_RESTARTS})，停止自动重启`);
    if (mainWindow) {
      mainWindow.webContents.send('backend-error', 
        `后端服务器启动失败，已尝试 ${MAX_BACKEND_RESTARTS} 次。请检查日志并手动重启应用。`);
    }
    return;
  }
  
  isBackendStarting = true;
  backendRestartCount++;
  
  // 在启动前彻底清理端口
  safeLog(`🔧 准备启动后端服务器 (尝试 ${backendRestartCount}/${MAX_BACKEND_RESTARTS})...`);
  safeLog(`🔍 检查端口 ${BACKEND_PORT} 状态...`);
  
  // 先检查端口是否被占用
  const portInUse = await new Promise((resolve) => {
    checkPortInUse(BACKEND_PORT, (inUse) => {
      resolve(inUse);
    });
  });
  
  if (portInUse) {
    safeLog(`⚠️  端口 ${BACKEND_PORT} 被占用，开始清理...`);
    const portCleaned = await cleanupPort(BACKEND_PORT);
    if (!portCleaned) {
      safeError('⚠️  端口清理失败，但仍尝试启动后端...');
    } else {
      safeLog('✅ 端口清理成功');
    }
    // 等待端口完全释放
    await new Promise(resolve => safeSetTimeout(resolve, 1000));
    
    // 再次检查端口
    const stillInUse = await new Promise((resolve) => {
      checkPortInUse(BACKEND_PORT, (inUse) => {
        resolve(inUse);
      });
    });
    
    if (stillInUse) {
      safeError(`❌ 端口 ${BACKEND_PORT} 仍被占用，无法启动后端`);
      isBackendStarting = false;
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', 
          `端口 ${BACKEND_PORT} 被占用，无法启动后端服务器。请手动关闭占用端口的进程。`);
      }
      return;
    }
  } else {
    safeLog(`✅ 端口 ${BACKEND_PORT} 可用`);
  }
  
  // 再次确保后端进程不存在
  if (backendProcess) {
    safeLog('⚠️  检测到后端进程仍存在，强制清理...');
    await stopBackend();
    await new Promise(resolve => safeSetTimeout(resolve, 500));
  }

  // 在开发模式下，使用 npm run webui
  if (isDev) {
    const projectRoot = getProjectRoot();
    console.log(`🔧 开发模式：启动后端服务器`);
    console.log(`📁 __dirname: ${__dirname}`);
    console.log(`📁 项目根目录: ${projectRoot}`);
    console.log(`📁 项目根目录存在: ${fs.existsSync(projectRoot)}`);
    
    // 验证项目根目录是否存在
    if (!fs.existsSync(projectRoot)) {
      const errorMsg = `项目根目录不存在: ${projectRoot}`;
      console.error(`❌ 无法启动后端：${errorMsg}`);
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', errorMsg);
      }
      isBackendStarting = false;
      return;
    }
    
    // 验证 package.json 是否存在
    const packageJsonPath = path.join(projectRoot, 'package.json');
    console.log(`📁 package.json路径: ${packageJsonPath}`);
    console.log(`📁 package.json存在: ${fs.existsSync(packageJsonPath)}`);
    if (!fs.existsSync(packageJsonPath)) {
      const errorMsg = `package.json 不存在: ${packageJsonPath}`;
      console.error(`❌ 无法启动后端：${errorMsg}`);
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', 'package.json 不存在');
      }
      isBackendStarting = false;
      return;
    }
    
    // 在开发模式下，也使用应用数据目录的配置文件
    // 应用数据目录应该已经在 app.whenReady() 中初始化
    if (!appData) {
      console.error('❌ 应用数据目录未初始化，尝试初始化...');
      appData = initializeAppData();
      if (!appData) {
        console.error('❌ 无法初始化应用数据目录');
        if (mainWindow) {
          mainWindow.webContents.send('backend-error', '无法初始化应用数据目录');
        }
        return;
      }
    }
    
    // 在开发模式下，也设置 STATIC_PATH，以便后端可以提供静态文件服务
    // 前端构建目录在 webui-frontend/dist
    const frontendDistPath = path.join(__dirname, '..', 'dist');
    const staticPath = fs.existsSync(frontendDistPath) ? frontendDistPath : undefined;
    
    // 优化：检查是否已经构建过，如果已构建则直接运行，避免重复构建
    const backendDistPath = path.join(projectRoot, 'dist', 'webui', 'index.js');
    const needsBuild = !fs.existsSync(backendDistPath);
    
    if (needsBuild) {
      console.log(`🚀 执行命令: npm run webui (需要先构建)`);
    } else {
      console.log(`🚀 执行命令: node dist/webui/index.js (使用已构建的文件)`);
    }
    console.log(`📁 配置文件路径: ${appData.configPath}`);
    console.log(`📁 应用数据目录: ${appData.appDataDir}`);
    if (staticPath) {
      console.log(`📁 静态文件路径: ${staticPath}`);
      console.log(`📁 静态文件路径存在: ${fs.existsSync(staticPath)}`);
    } else {
      console.log(`⚠️  静态文件路径不存在，后端将只提供 API 服务`);
      console.log(`💡 提示: 前端应通过 Vite 开发服务器 (http://localhost:5173) 提供`);
    }
    
    const env = {
      ...process.env,
      STATIC_PATH: staticPath,
      PIXIV_DOWNLOADER_CONFIG: appData.configPath, // 在开发模式下也使用应用数据目录的配置文件
    };
    
    // 如果已经构建过，直接运行，避免重复构建
    try {
      if (!needsBuild) {
        safeLog(`🚀 启动后端: node ${backendDistPath}`);
        backendProcess = spawn('node', [backendDistPath], {
          cwd: projectRoot,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: env,
        });
      } else {
        safeLog(`🚀 启动后端: npm run webui`);
        backendProcess = spawn('npm', ['run', 'webui'], {
          cwd: projectRoot,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: env,
        });
      }
    } catch (error) {
      isBackendStarting = false;
      safeError('❌ 无法启动后端进程:', error);
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', `无法启动后端进程: ${error.message}`);
      }
      return;
    }
    
    if (!backendProcess) {
      isBackendStarting = false;
      safeError('❌ 后端进程创建失败');
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', '后端进程创建失败');
      }
      return;
    }
    
    // 监听后端进程输出，检测启动完成
    let backendReady = false;
    const checkReady = () => {
      if (!backendReady) {
        checkBackendReady((ready) => {
          if (ready && !backendReady) {
            backendReady = true;
            isBackendStarting = false; // 立即重置启动标志
            backendRestartCount = 0; // 重置重启计数
            safeLog('✅ 后端服务器启动成功');
            notifyBackendReady();
          }
        });
      }
    };
    
    // 定期检查后端是否就绪（最多60秒）
    let checkAttempts = 0;
    const maxCheckAttempts = 120; // 60秒
    const readyCheckInterval = safeSetInterval(() => {
      if (backendReady || isAppClosing) {
        clearInterval(readyCheckInterval);
        activeTimers.delete(readyCheckInterval);
        return;
      }
      checkAttempts++;
      checkReady();
      if (checkAttempts >= maxCheckAttempts) {
        clearInterval(readyCheckInterval);
        activeTimers.delete(readyCheckInterval);
        isBackendStarting = false; // 超时后也重置标志
        safeError('⚠️  后端服务器启动检查超时');
        if (mainWindow) {
          mainWindow.webContents.send('backend-error', '后端服务器启动超时，请检查日志');
        }
      }
    }, 500);
    
    // 输出后端进程的 stdout 和 stderr（用于调试）
    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[Backend] ${output}`);
          // 检测后端启动完成的关键字
          if (output.includes('Server started') || 
              output.includes('Server ready') ||
              output.includes('listening on') || 
              output.includes('WebUI server') ||
              output.includes('PORT:')) {
            // 延迟一点再检查，确保服务器完全启动
            safeSetTimeout(() => checkReady(), 1000);
          }
        }
      });
    }
    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.error(`[Backend Error] ${output}`);
        }
      });
    }
  } else {
    // 生产模式下，从 extraResources 加载后端
    // electron-builder 会将后端文件复制到 resources/dist
    // 直接使用 index.js，因为 dist/webui/package.json 明确指定了 "type": "commonjs"
    const backendPath = path.join(process.resourcesPath, 'dist', 'webui', 'index.js');
    // 向后兼容：如果 index.js 不存在，尝试 index.cjs
    const backendPathFallback = path.join(process.resourcesPath, 'dist', 'webui', 'index.cjs');
    let finalBackendPath = fs.existsSync(backendPath) ? backendPath : backendPathFallback;
    // 前端静态文件路径（在打包后的应用中）
    // 前端 dist 也在 extraResources 中，路径为 resources/webui-dist
    const staticPath = path.join(process.resourcesPath, 'webui-dist');
    
    console.log(`🔧 生产模式：启动后端服务器`);
    console.log(`📁 resourcesPath: ${process.resourcesPath}`);
    console.log(`📁 后端路径: ${finalBackendPath}`);
    console.log(`📁 静态文件路径: ${staticPath}`);
    
    // 验证后端文件是否存在
    if (!validatePath(finalBackendPath, '后端文件')) {
      console.error('❌ 无法启动后端：后端文件不存在');
      console.error('提示: 请确保构建时包含了后端文件');
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', '后端文件不存在，请重新构建应用');
      }
      return;
    }
    
    // 验证静态文件目录是否存在
    if (!validatePath(staticPath, '静态文件目录')) {
      console.error('❌ 无法启动后端：静态文件目录不存在');
      console.error('提示: 请确保构建时包含了前端静态文件');
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', '静态文件目录不存在，请重新构建应用');
      }
      return;
    }
    
    // 使用已初始化的应用数据目录（如果还没有初始化，则初始化）
    if (!appData) {
      appData = initializeAppData();
      if (!appData) {
        console.error('❌ 无法初始化应用数据目录');
        if (mainWindow) {
          mainWindow.webContents.send('backend-error', '无法初始化应用数据目录');
        }
        return;
      }
    }
    
    // 后端 node_modules 路径
    const backendNodeModules = path.join(process.resourcesPath, 'backend-node_modules');
    
    // 设置 NODE_PATH，让 Node.js 能找到后端依赖
    const nodePath = [
      backendNodeModules,
      process.env.NODE_PATH || '',
    ].filter(Boolean).join(path.delimiter);
    
    const backendExecutable = process.execPath;
    const backendEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      NODE_PATH: nodePath, // 设置 NODE_PATH 以加载后端依赖
      STATIC_PATH: staticPath,
      PORT: BACKEND_PORT.toString(),
      HOST: 'localhost',
      PIXIV_DOWNLOADER_CONFIG: appData.configPath, // 设置配置文件路径
    };

    safeLog(`🚀 启动后端进程: ${backendExecutable} ${finalBackendPath}`);
    safeLog(`📦 NODE_PATH: ${nodePath}`);
    safeLog(`📁 STATIC_PATH: ${staticPath}`);
    safeLog(`📁 配置文件路径: ${appData.configPath}`);
    safeLog(`📁 应用数据目录: ${appData.appDataDir}`);
    safeLog(`📁 ELECTRON_RUN_AS_NODE: ${backendEnv.ELECTRON_RUN_AS_NODE}`);
    safeLog(`📁 STATIC_PATH 存在: ${fs.existsSync(staticPath)}`);
    if (fs.existsSync(staticPath)) {
      safeLog(`📁 STATIC_PATH 内容: ${fs.readdirSync(staticPath).join(', ')}`);
    }
    
    try {
      backendProcess = spawn(backendExecutable, [finalBackendPath], {
        stdio: ['ignore', 'pipe', 'pipe'], // 使用 pipe 以便捕获输出
        cwd: appData.appDataDir, // 设置工作目录为应用数据目录
        env: backendEnv,
      });
    } catch (error) {
      isBackendStarting = false;
      safeError('❌ 无法启动后端进程:', error);
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', `无法启动后端进程: ${error.message}`);
      }
      return;
    }
    
    if (!backendProcess) {
      isBackendStarting = false;
      safeError('❌ 后端进程创建失败');
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', '后端进程创建失败');
      }
      return;
    }
    
    // 监听后端进程输出，检测启动完成
    let backendReady = false;
    let checkAttempts = 0; // 提前定义，供 checkReady 使用
    const checkReady = () => {
      if (!backendReady) {
        checkBackendReady((ready) => {
          if (ready && !backendReady) {
            backendReady = true;
            isBackendStarting = false; // 立即重置启动标志
            backendRestartCount = 0; // 重置重启计数
            safeLog('✅ 后端服务器启动成功，HTTP 健康检查通过');
            // 延迟一点再通知，确保后端完全就绪
            safeSetTimeout(() => {
              notifyBackendReady();
            }, 200);
          } else if (!ready && !backendReady && checkAttempts > 0 && checkAttempts % 10 === 0) {
            // 后端还未就绪，每5秒记录一次状态
            safeLog(`⏳ 等待后端就绪... (已等待 ${(checkAttempts * 0.5).toFixed(1)} 秒)`);
          }
        });
      }
    };
    
    // 定期检查后端是否就绪（最多60秒）
    const maxCheckAttempts = 120; // 60秒
    const readyCheckInterval = safeSetInterval(() => {
      if (backendReady || isAppClosing) {
        clearInterval(readyCheckInterval);
        activeTimers.delete(readyCheckInterval);
        return;
      }
      checkAttempts++;
      if (checkAttempts % 10 === 0) { // 每5秒记录一次
        safeLog(`🔍 检查后端就绪状态 (${checkAttempts}/${maxCheckAttempts})...`);
      }
      checkReady();
      if (checkAttempts >= maxCheckAttempts) {
        clearInterval(readyCheckInterval);
        activeTimers.delete(readyCheckInterval);
        isBackendStarting = false; // 超时后也重置标志
        safeError('⚠️  后端服务器启动检查超时');
        if (mainWindow && !mainWindow.webContents.isDestroyed()) {
          try {
            mainWindow.webContents.send('backend-error', '后端服务器启动超时，请检查日志');
          } catch (e) {
            safeError('发送错误消息失败:', e);
          }
        }
      }
    }, 500);
    
    // 输出后端进程的 stdout 和 stderr（用于调试）
    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[Backend] ${output}`);
          
          // 检测实际使用的端口号（格式：PORT: 3001 或 started on http://localhost:3001）
          const portMatch = output.match(/PORT:\s*(\d+)/i) || 
                           output.match(/started on http:\/\/[^:]+:(\d+)/i) ||
                           output.match(/listening on port\s*(\d+)/i) ||
                           output.match(/on port\s*(\d+)/i);
          if (portMatch && portMatch[1]) {
            const detectedPort = parseInt(portMatch[1], 10);
            if (detectedPort !== actualBackendPort) {
              actualBackendPort = detectedPort;
              safeLog(`🔍 检测到后端实际使用端口: ${actualBackendPort}`);
            }
          }
          
          // 检测后端启动完成的关键字
          if (output.includes('Server started') || 
              output.includes('Server ready') ||
              output.includes('listening on') || 
              output.includes('WebUI server') ||
              output.includes('PORT:') ||
              output.includes('started on port') ||
              output.includes('listening on port')) {
            safeLog('📢 检测到后端启动信号，准备检查就绪状态');
            // 延迟一点再检查，确保服务器完全启动
            safeSetTimeout(() => {
              safeLog('🔍 执行后端就绪检查...');
              checkReady();
            }, 1500);
          }
        }
      });
    }
    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.error(`[Backend Error] ${output}`);
        }
      });
    }
  }

  // 错误处理（必须在 spawn 之后设置）
  if (backendProcess) {
    backendProcess.on('error', (err) => {
      isBackendStarting = false;
      safeError('❌ 后端进程启动错误:', err);
      safeError('错误详情:', err.message);
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', err.message);
      }
      backendProcess = null;
      
      // 延迟后尝试重启
      if (!isAppClosing && backendRestartCount < MAX_BACKEND_RESTARTS) {
        safeSetTimeout(() => {
          if (!backendProcess && !isAppClosing) {
            startBackend();
          }
        }, 3000);
      }
    });

    backendProcess.on('exit', async (code, signal) => {
      isBackendStarting = false;
      
      // 清理端口（无论是否正常退出）
      safeLog('🧹 清理后端进程占用的端口...');
      await cleanupPort(BACKEND_PORT);
      await new Promise(resolve => safeSetTimeout(resolve, 500));
      
      if (code === 0) {
        safeLog('✅ 后端进程正常退出');
        backendRestartCount = 0; // 重置重启计数
      } else {
        safeError(`❌ 后端进程异常退出，退出码: ${code}, 信号: ${signal || '无'}`);
        
        // 检查退出原因，如果是端口占用错误，增加延迟时间
        const isPortError = code === 1 && signal === null; // 端口错误通常是退出码1
        
        // 如果不是主动退出且未达到重启限制，尝试重启
        if (code !== null && code !== 0 && !signal && !isAppClosing) {
          if (backendRestartCount < MAX_BACKEND_RESTARTS) {
            const delay = isPortError ? 5000 : 3000; // 端口错误时延迟更长时间
            safeLog(`⚠️  后端进程异常退出，将在 ${delay / 1000} 秒后尝试重启 (${backendRestartCount}/${MAX_BACKEND_RESTARTS})...`);
            safeSetTimeout(async () => {
              if (!backendProcess && !isAppClosing) {
                // 在重启前再次确保端口已释放
                const portInUse = await new Promise((resolve) => {
                  checkPortInUse(BACKEND_PORT, (inUse) => {
                    resolve(inUse);
                  });
                });
                if (portInUse) {
                  safeLog('⚠️  端口仍被占用，清理端口...');
                  await cleanupPort(BACKEND_PORT);
                  await new Promise(resolve => safeSetTimeout(resolve, 1000));
                }
                startBackend();
              }
            }, delay);
          } else {
            safeError(`❌ 后端重启次数已达上限，停止自动重启`);
            if (mainWindow) {
              mainWindow.webContents.send('backend-error', 
                `后端服务器启动失败，已尝试 ${MAX_BACKEND_RESTARTS} 次。请检查日志并手动重启应用。`);
            }
          }
        }
      }
      backendProcess = null;
    });
    
    // 注意：isBackendStarting 标志现在在 checkReady() 回调中重置
    // 这里不再需要额外的重置逻辑，因为启动检测已经在上面处理了
  }
  
  // 如果 backendProcess 为 null，说明启动失败，重置标志
  if (!backendProcess) {
    isBackendStarting = false;
  }
}
*/

// 认证相关函数已移至 authService
const generateCodeVerifier = () => authService.generateCodeVerifier();
const generateCodeChallenge = (verifier) => authService.generateCodeChallenge(verifier);

// 以下为旧的实现，已移至 services/auth.js
/*
function findChromeExecutable_OLD() {
  const platform = process.platform;
  const possiblePaths = [];

  if (platform === 'darwin') {
    // macOS
    possiblePaths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
      path.join(os.homedir(), 'Applications', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
    );
  } else if (platform === 'win32') {
    // Windows
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    
    possiblePaths.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Chromium', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Chromium', 'Application', 'chrome.exe')
    );
  } else if (platform === 'linux') {
    // Linux
    possiblePaths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/usr/local/bin/chrome',
      '/usr/local/bin/chromium'
    );
  }

  // 检查每个可能的路径
  for (const chromePath of possiblePaths) {
    try {
      if (fs.existsSync(chromePath)) {
        console.log(`✅ 找到 Chrome/Chromium: ${chromePath}`);
        return chromePath;
      }
    } catch (error) {
      // 忽略文件系统错误
    }
  }

  console.warn('⚠️  未找到系统 Chrome/Chromium，Puppeteer 将尝试使用默认路径');
  return null;
}
*/

// 认证登录函数已移至 authService
const loginWithPixivTokenGetter = (proxyConfig) => authService.loginWithPixivTokenGetter(proxyConfig);
const loginWithPuppeteer = (codeVerifier, codeChallenge, proxyConfig) => authService.loginWithPuppeteer(codeVerifier, codeChallenge, proxyConfig);
const closeLoginWindow = () => authService.closeLoginWindow();

// 以下为旧的实现，已移至 services/auth.js（已删除注释代码以清理文件）

// 以下函数已移至 authService，但在 main.cjs 中保留实现以支持 IPC 处理
// 这些函数作为 authService 的补充，处理 Electron 特定的逻辑
// 注意：这些函数当前未被直接调用，但保留作为备用实现

// eslint-disable-next-line no-unused-vars
async function checkForCallbackUrl(url) {
  // 如果正在处理，忽略（防止重复处理）
  if (authService.isProcessingAuthCode) {
    return false;
  }

  // 如果没有code verifier，说明登录流程未开始或已结束
  if (!authService.currentLoginCodeVerifier) {
    return false;
  }

  // 如果URL为空或无效，忽略
  if (!url || typeof url !== 'string' || url === 'about:blank' || url === 'about:') {
    return false;
  }

  // 快速检查：如果URL不包含code或error参数，直接返回
  // 同时检查callback URL模式
  const hasCode = url.includes('code=') || url.includes('?code=') || url.includes('&code=');
  const hasError = url.includes('error=') || url.includes('?error=') || url.includes('&error=');
  const isCallbackUrl = url.includes('callback') || url.includes('app-api.pixiv.net/web/v1/users/auth/pixiv/callback');
  
  // 如果是回调URL但没有code或error参数，记录日志以便调试
  if (isCallbackUrl && !hasCode && !hasError) {
    console.log('🔍 检测到回调URL但没有code/error参数:', url);
  }
  
  if (!hasCode && !hasError && !isCallbackUrl) {
    return false;
  }

  try {
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (e) {
      // 如果URL解析失败，尝试处理相对URL
      if (url.startsWith('/')) {
        try {
          urlObj = new URL(url, 'https://app-api.pixiv.net');
        } catch (e2) {
          // 如果还是失败，检查是否是fragment中的参数
          const hashMatch = url.match(/[#&](code|error)=([^&]+)/);
          if (hashMatch) {
            // 从hash中提取参数
            const paramName = hashMatch[1];
            const paramValue = hashMatch[2];
            if (paramName === 'code' && paramValue && paramValue.length > 0) {
              return authService.handleAuthCode(paramValue, url);
            } else if (paramName === 'error') {
              return authService.handleAuthError(paramValue, url);
            }
          }
          return false;
        }
      } else {
        return false;
      }
    }
    
    // 检查 URL 中是否有 code 参数（包括search和hash）
    const code = urlObj.searchParams.get('code') || (urlObj.hash ? new URLSearchParams(urlObj.hash.substring(1)).get('code') : null);
    
    if (code && code.length > 0 && authService.currentLoginCodeVerifier) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎉🎉🎉 成功捕获回调URL！');
      console.log('═══════════════════════════════════════════════════════');
      console.log('   回调URL:', url);
      console.log('   授权码 (前30字符):', code.substring(0, 30) + '...');
      console.log('   授权码长度:', code.length);
      console.log('   时间戳:', new Date().toISOString());
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      return authService.handleAuthCode(code, url);
    }
    
    // 检查是否有错误参数（包括search和hash）
    const error = urlObj.searchParams.get('error') || (urlObj.hash ? new URLSearchParams(urlObj.hash.substring(1)).get('error') : null);
    if (error) {
      const errorDescription = urlObj.searchParams.get('error_description') || 
                              (urlObj.hash ? new URLSearchParams(urlObj.hash.substring(1)).get('error_description') : null) ||
                              error;
      return authService.handleAuthError(error, errorDescription, url);
    }
    
    return false; // 未找到code或error参数
  } catch (error) {
    // URL 解析失败 - 尝试从原始URL字符串中提取
    try {
      // 尝试使用正则表达式提取code参数
      const codeMatch = url.match(/[?&#]code=([^&#]+)/);
      if (codeMatch && codeMatch[1] && currentLoginCodeVerifier) {
        const code = decodeURIComponent(codeMatch[1]);
        if (code && code.length > 0) {
          console.log('⚠️  从URL字符串中提取到授权码（URL解析失败）');
          return authService.handleAuthCode(code, url);
        }
      }
      
      // 尝试提取error参数
      const errorMatch = url.match(/[?&#]error=([^&#]+)/);
      if (errorMatch && errorMatch[1]) {
        const error = decodeURIComponent(errorMatch[1]);
        const errorDescMatch = url.match(/[?&#]error_description=([^&#]+)/);
        const errorDescription = errorDescMatch ? decodeURIComponent(errorDescMatch[1]) : error;
        return authService.handleAuthError(error, errorDescription, url);
      }
    } catch (extractError) {
      // 提取也失败，静默忽略
    }
    return false;
  }
}

/**
 * 处理授权码 - 提取并交换token
 */
// eslint-disable-next-line no-unused-vars
async function handleAuthCode(code, sourceUrl) {
  // 立即标记为正在处理，防止重复处理
  if (isProcessingAuthCode) {
    return false;
  }
  
  isProcessingAuthCode = true;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅✅✅ 成功检测到授权码！');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   授权码 (前20字符):', code.substring(0, 20) + '...');
  console.log('   授权码长度:', code.length);
  console.log('   来源 URL:', sourceUrl);
  console.log('   时间戳:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // 保存code verifier（在清除之前）
  const codeVerifier = currentLoginCodeVerifier;
  
  // 立即清除，防止重复使用
  currentLoginCodeVerifier = null;
  
  // 立即关闭登录窗口（不等待token交换完成）
  closeLoginWindow();

  // 异步交换token（不阻塞）
  exchangeCodeForToken(code, codeVerifier)
    .then(async (result) => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅✅✅ Token 交换成功！');
      console.log('═══════════════════════════════════════════════════════');
      console.log('   Access Token (前20字符):', result.data.accessToken ? result.data.accessToken.substring(0, 20) + '...' : 'N/A');
      console.log('   Refresh Token (前20字符):', result.data.refreshToken ? result.data.refreshToken.substring(0, 20) + '...' : 'N/A');
      console.log('   过期时间:', result.data.expiresIn, '秒');
      console.log('   用户信息:', result.data.user ? JSON.stringify(result.data.user, null, 2) : 'N/A');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      
      // 确保登录窗口已关闭（双重保险）
      closeLoginWindow();
      
      // 尝试将 token 保存到后端配置（带重试机制）
      await saveTokenToBackend(result.data.refreshToken, 3);
      
      // 通知主窗口登录成功（前端也会尝试保存 token）
      // 使用标志位防止重复发送
      let eventSent = false;
      const sendLoginSuccessEvent = () => {
        // 如果事件已经发送成功，不再重复发送
        if (eventSent) {
          return;
        }
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          const eventData = result.data;
          console.log('📤 发送 login-success 事件到主窗口 (BrowserWindow):', {
            hasRefreshToken: !!eventData.refreshToken,
            hasAccessToken: !!eventData.accessToken,
            windowReady: !mainWindow.isDestroyed(),
          });
          try {
            mainWindow.webContents.send('login-success', eventData);
            console.log('✅ login-success 事件已发送 (BrowserWindow)');
            eventSent = true; // 标记为已发送
            resetLoginWindowFlag(); // 重置标志位
            
            // 备选方案：如果 3 秒后还在登录页面，强制导航到 dashboard
            // 前端应该已经处理了导航，但这是最后的保障
            setTimeout(() => {
              try {
                const currentUrl = mainWindow.webContents.getURL();
                console.log('🔍 检查当前页面 URL:', currentUrl);
                if (currentUrl && currentUrl.includes('/login')) {
                  console.log('🔄 检测到仍在登录页面，尝试强制导航到 dashboard...');
                  // 使用 loadURL 作为最后的手段
                  const dashboardUrl = `http://localhost:${actualBackendPort}/dashboard`;
                  mainWindow.webContents.loadURL(dashboardUrl).then(() => {
                    console.log('✅ 已通过 loadURL 导航到 dashboard');
                  }).catch(err => {
                    console.error('❌ loadURL 导航失败:', err.message);
                    // 最后尝试：使用 executeJavaScript
                    mainWindow.webContents.executeJavaScript(`
                      window.location.href = '/dashboard';
                    `).catch(jsErr => {
                      console.error('❌ executeJavaScript 导航也失败:', jsErr.message);
                    });
                  });
                } else {
                  console.log('✅ 页面已不在登录页面，导航成功');
                }
              } catch (checkError) {
                console.error('❌ 检查页面 URL 时出错:', checkError.message);
              }
            }, 3000); // 增加到 3 秒，给前端更多时间处理
          } catch (sendError) {
            console.error('❌ 发送登录成功事件失败:', sendError.message);
            // 发送失败时不设置标志，允许重试
          }
        } else {
          console.error('❌ 主窗口不存在或已销毁，无法发送事件');
          // 窗口未准备好时不设置标志，允许重试
        }
      };
      
      // 立即尝试发送，如果页面未加载，延迟后重试（但只会发送一次）
      sendLoginSuccessEvent();
      setTimeout(sendLoginSuccessEvent, 500);
      setTimeout(sendLoginSuccessEvent, 1000);
    })
    .catch((error) => {
      console.error('');
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌❌❌ Token 交换失败！');
      console.error('═══════════════════════════════════════════════════════');
      console.error('   错误消息:', error.message);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error('   HTTP状态:', error.response.status, error.response.statusText);
        console.error('   响应数据:', JSON.stringify(error.response.data, null, 2));
      } else if (error.response) {
        console.error('   HTTP状态:', error.response.status);
        console.error('   响应数据:', JSON.stringify(error.response.data, null, 2));
      }
      
      if (error.request) {
        console.error('   请求信息:', error.request);
      }
      
      console.error('   错误堆栈:', error.stack);
      console.error('═══════════════════════════════════════════════════════');
      console.error('');
      
      // 确保登录窗口已关闭（即使失败也要关闭）
      closeLoginWindow();
      
      // 通知主窗口登录失败
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('login-error', { 
            message: error.message || 'Token交换失败',
            details: error.response ? error.response.data : null,
            code: error.code || 'UNKNOWN_ERROR'
          });
          console.log('✅ 已发送登录失败事件到主窗口');
        } catch (sendError) {
          console.error('❌ 发送登录失败事件失败:', sendError.message);
        }
      }
      resetLoginWindowFlag(); // 重置标志位
    })
    .finally(() => {
      // 最终确保窗口已关闭并清理资源
      closeLoginWindow();
      isProcessingAuthCode = false;
    });
  
  return true; // 表示已找到授权码
}

/**
 * 处理认证错误
 */
// eslint-disable-next-line no-unused-vars
function handleAuthError(error, errorDescription, sourceUrl) {
  console.error('');
  console.error('═══════════════════════════════════════════════════════');
  console.error('❌ 登录过程中发生错误');
  console.error('═══════════════════════════════════════════════════════');
  console.error('   错误代码:', error);
  console.error('   错误描述:', errorDescription);
  console.error('   错误URL:', sourceUrl);
  console.error('═══════════════════════════════════════════════════════');
  console.error('');
  
  // 关闭登录窗口并清理资源
  closeLoginWindow();
  isProcessingAuthCode = false;
  currentLoginCodeVerifier = null;

  // 通知主窗口登录失败
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('login-error', { 
        message: errorDescription || error || '登录过程中发生错误',
        errorCode: error,
        code: error || 'AUTH_ERROR'
      });
      console.log('✅ 已发送登录错误事件到主窗口');
    } catch (sendError) {
      console.error('❌ 发送登录错误事件失败:', sendError.message);
    }
  }
  resetLoginWindowFlag(); // 重置标志位
  
  return true; // 表示已处理错误
}

/**
 * 显示授权码输入对话框
 * 引导用户从浏览器回调URL中提取授权码
 */
// eslint-disable-next-line no-unused-vars
function showAuthCodeInputDialog() {
  return new Promise((resolve) => {
    // 创建授权码输入窗口
    const authCodeWindow = new BrowserWindow({
      width: 600,
      height: 500,
      parent: mainWindow,
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: true,
      },
      title: 'Pixiv 登录 - 输入授权码',
      show: false,
    });

    // 创建辅助页面HTML
    const helperHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pixiv 登录 - 输入授权码</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      padding: 30px;
      color: #333;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 10px;
      color: #333;
    }
    .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .steps {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .step {
      margin-bottom: 20px;
    }
    .step:last-child {
      margin-bottom: 0;
    }
    .step-number {
      display: inline-block;
      width: 24px;
      height: 24px;
      background: #667eea;
      color: white;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      font-size: 14px;
      font-weight: bold;
      margin-right: 10px;
    }
    .step-text {
      display: inline-block;
      vertical-align: top;
      width: calc(100% - 40px);
      font-size: 14px;
      line-height: 1.6;
    }
    .code-example {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 10px;
      margin-top: 10px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      color: #495057;
      word-break: break-all;
    }
    .code-example .highlight {
      color: #667eea;
      font-weight: bold;
    }
    .input-section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .input-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }
    input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: 'Monaco', 'Courier New', monospace;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }
    .buttons {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover {
      background: #5568d3;
    }
    .btn-secondary {
      background: #e9ecef;
      color: #495057;
    }
    .btn-secondary:hover {
      background: #dee2e6;
    }
    .help-text {
      font-size: 12px;
      color: #666;
      margin-top: 8px;
    }
    .error {
      color: #dc3545;
      font-size: 12px;
      margin-top: 8px;
      display: none;
    }
    .error.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Pixiv 登录</h1>
    <p class="subtitle">请在浏览器中完成登录，然后输入授权码</p>
    
    <div class="steps">
      <div class="step">
        <span class="step-number">1</span>
        <span class="step-text">在浏览器中完成 Pixiv 登录</span>
      </div>
      <div class="step">
        <span class="step-number">2</span>
        <span class="step-text">登录成功后，浏览器会跳转到回调页面。查看浏览器地址栏中的URL，找到 <span class="highlight">code=</span> 后面的部分</span>
      </div>
      <div class="step">
        <span class="step-number">3</span>
        <span class="step-text">复制授权码（code= 后面的字符串），粘贴到下面的输入框中</span>
      </div>
    </div>
    
    <div class="code-example">
      示例URL：<br>
      https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback?<span class="highlight">code=xxxxxxxxxxxxxxxxxxxxxxxx</span>&state=...
    </div>
    
    <div class="input-section">
      <div class="input-group">
        <label for="authCode">授权码 (Authorization Code)</label>
        <input 
          type="text" 
          id="authCode" 
          placeholder="请输入授权码..." 
          autocomplete="off"
          autofocus
        />
        <div class="help-text">从浏览器回调URL的 code= 参数中复制</div>
        <div class="error" id="error"></div>
      </div>
      
      <div class="buttons">
        <button class="btn-secondary" id="cancelBtn">取消</button>
        <button class="btn-primary" id="submitBtn">确定</button>
      </div>
    </div>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    const authCodeInput = document.getElementById('authCode');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const errorDiv = document.getElementById('error');
    
    // 从全局变量获取通道名称（将在页面加载后注入）
    let submitChannel = 'auth-code-submitted';
    let cancelChannel = 'auth-code-cancelled';
    
    function showError(message) {
      errorDiv.textContent = message;
      errorDiv.classList.add('show');
    }
    
    function hideError() {
      errorDiv.classList.remove('show');
    }
    
    function validateAuthCode(code) {
      if (!code || code.trim() === '') {
        return '请输入授权码';
      }
      if (code.length < 10) {
        return '授权码长度不正确，请检查是否复制完整';
      }
      return null;
    }
    
    submitBtn.addEventListener('click', () => {
      const code = authCodeInput.value.trim();
      const error = validateAuthCode(code);
      
      if (error) {
        showError(error);
        return;
      }
      
      hideError();
      ipcRenderer.send(submitChannel, code);
    });
    
    cancelBtn.addEventListener('click', () => {
      ipcRenderer.send(cancelChannel);
    });
    
    // 按 Enter 键提交
    authCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });
    
    // 自动从剪贴板粘贴（如果包含code=）
    navigator.clipboard.readText().then(text => {
      const match = text.match(/[?&]code=([^&]+)/);
      if (match && match[1]) {
        authCodeInput.value = match[1];
        authCodeInput.select();
      }
    }).catch(() => {
      // 忽略剪贴板读取错误
    });
    
    // 设置通道名称的函数（将在页面加载后调用）
    window.setChannels = function(submit, cancel) {
      submitChannel = submit;
      cancelChannel = cancel;
    };
  </script>
</body>
</html>`;

    // 创建唯一的事件通道
    const channelId = `auth-code-${Date.now()}-${Math.random()}`;
    const submitChannel = `${channelId}-submit`;
    const cancelChannel = `${channelId}-cancel`;

    // 处理授权码提交
    const submitHandler = (event, code) => {
      // 只处理来自 authCodeWindow 的事件
      if (event.sender === authCodeWindow.webContents) {
        if (authCodeWindow && !authCodeWindow.isDestroyed()) {
          authCodeWindow.close();
        }
        ipcMain.removeListener(submitChannel, submitHandler);
        ipcMain.removeListener(cancelChannel, cancelHandler);
        resolve(code);
      }
    };

    // 处理取消
    const cancelHandler = (event) => {
      // 只处理来自 authCodeWindow 的事件
      if (event.sender === authCodeWindow.webContents) {
        if (authCodeWindow && !authCodeWindow.isDestroyed()) {
          authCodeWindow.close();
        }
        ipcMain.removeListener(submitChannel, submitHandler);
        ipcMain.removeListener(cancelChannel, cancelHandler);
        resolve(null);
      }
    };

    ipcMain.on(submitChannel, submitHandler);
    ipcMain.on(cancelChannel, cancelHandler);

    // 加载辅助页面
    authCodeWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(helperHTML)}`);

    // 页面加载完成后注入通道名称
    authCodeWindow.webContents.once('did-finish-load', () => {
      authCodeWindow.webContents.executeJavaScript(`
        if (window.setChannels) {
          window.setChannels('${submitChannel}', '${cancelChannel}');
        }
      `).catch(err => {
        console.error('注入通道名称失败:', err);
      });
    });

    // 窗口关闭时清理
    authCodeWindow.on('closed', () => {
      // 移除事件监听器
      ipcMain.removeListener(submitChannel, submitHandler);
      ipcMain.removeListener(cancelChannel, cancelHandler);
      // 如果窗口关闭时还没有resolve，resolve为null
      resolve(null);
    });

    // 显示窗口
    authCodeWindow.once('ready-to-show', () => {
      authCodeWindow.show();
      authCodeWindow.focus();
    });
  });
}

/**
 * 重置登录窗口打开标志位
 */
// eslint-disable-next-line no-unused-vars
function resetLoginWindowFlag() {
  isOpeningLoginWindow = false;
  console.log('✅ 已重置登录窗口打开标志位');
}

/**
 * 保存token到后端（带重试机制）
 */
async function saveTokenToBackend(refreshToken, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      safeLog(`💾 正在保存 token 到后端配置 (尝试 ${attempt}/${maxRetries})...`);
      
      // 等待后端就绪（最多等待10秒）
      let backendReady = false;
      const actualBackendPort = backendService.actualBackendPort;
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => safeSetTimeout(resolve, 500));
        try {
          const response = await axios.get(`http://localhost:${actualBackendPort}/api/health`, {
            timeout: 2000,
            validateStatus: () => true
          });
          if (response.status === 200) {
            backendReady = true;
            break;
          }
        } catch (e) {
          // 继续等待
        }
      }
      
      if (!backendReady) {
        safeLog(`⚠️  后端未就绪 (尝试 ${attempt}/${maxRetries})，前端将尝试保存 token`);
        if (attempt < maxRetries) {
          await new Promise(resolve => safeSetTimeout(resolve, 2000));
          continue;
        }
        return false;
      }
      
      // 调用后端 API 保存 token
      const response = await axios.post(
        `http://localhost:${actualBackendPort}/api/auth/login-with-token`,
        {
          refreshToken: refreshToken
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          },
          validateStatus: (status) => status >= 200 && status < 500
        }
      );
      
      if (response.data && response.data.success) {
        safeLog('✅ Token 已成功保存到后端配置');
        return true;
      } else {
        throw new Error(response.data?.message || '保存token失败：响应未成功');
      }
    } catch (saveError) {
      const errorMsg = saveError.response?.data?.message || saveError.message || '未知错误';
      safeLog(`⚠️  保存 token 到后端配置失败 (尝试 ${attempt}/${maxRetries}):`, errorMsg);
      
      if (attempt < maxRetries) {
        // 等待后重试（指数退避）
        const delay = 1000 * Math.pow(2, attempt - 1);
        safeLog(`   将在 ${delay / 1000} 秒后重试...`);
        await new Promise(resolve => safeSetTimeout(resolve, delay));
      } else {
        safeLog('⚠️  所有重试都失败，前端仍会尝试保存 token');
        return false;
      }
    }
  }
  
  return false;
}

// 以下为旧的 stopBackend 实现，已移至 services/backend.js
/*
async function stopBackend_OLD() {
  return new Promise((resolve) => {
    if (!backendProcess) {
      resolve();
      return;
    }
    
    safeLog('🛑 正在停止后端服务器...');
    isBackendStarting = false;
    
    const proc = backendProcess;
    backendProcess = null; // 立即清空引用，防止重复调用
    
    // 标记进程已退出
    let exited = false;
    const onExit = () => {
      if (!exited) {
        exited = true;
        safeLog('✅ 后端进程已停止');
        // 清理端口
        cleanupPort(BACKEND_PORT).then(() => {
          resolve();
        });
      }
    };
    
    proc.once('exit', onExit);
    
    // 尝试优雅关闭
    try {
      if (process.platform === 'win32') {
        proc.kill();
      } else {
        proc.kill('SIGTERM');
      }
      
      // 如果5秒后还没退出，强制杀死
      safeSetTimeout(() => {
        if (!exited && proc && !proc.killed) {
          safeLog('⚠️  后端进程未响应，强制终止...');
          try {
            proc.kill('SIGKILL');
          } catch (err) {
            safeError('强制终止进程失败:', err);
          }
        }
        
        // 如果10秒后还没退出，认为已停止
        safeSetTimeout(() => {
          if (!exited) {
            onExit();
          }
        }, 5000);
      }, 5000);
    } catch (err) {
      safeError('停止后端进程时出错:', err);
      onExit();
    }
  });
}
*/

// 初始化 IPC 处理程序（只注册一次，避免重复注册）
function setupIpcHandlers() {
  // 移除已存在的处理程序（如果存在），避免重复注册错误
  try {
    ipcMain.removeAllListeners('backend-ready');
    ipcMain.removeHandler('open-login-window');
    ipcMain.removeHandler('close-login-window');
    ipcMain.removeHandler('window-minimize');
    ipcMain.removeHandler('window-maximize');
    ipcMain.removeHandler('window-close');
  } catch (error) {
    // 如果移除失败（比如处理程序不存在），忽略错误
    console.log('清理 IPC 处理程序:', error.message);
  }

  // 监听后端就绪事件
  ipcMain.on('backend-ready', () => {
    backendService.notifyBackendReady();
  });

  // 处理登录窗口请求 - 优先使用 pixiv-token-getter，然后是 Puppeteer，最后是 BrowserWindow
  ipcMain.handle('open-login-window', async (event, options = {}) => {
    try {
      // 防止重复打开登录窗口
      if (isOpeningLoginWindow) {
        console.log('⚠️  登录窗口正在打开中，忽略重复请求');
        return { 
          success: false, 
          error: '登录窗口正在打开中，请勿重复点击',
          alreadyOpening: true 
        };
      }
      
      // 检查是否已有登录窗口或浏览器实例
      const hasExistingWindow = loginWindow && !loginWindow.isDestroyed();
      const hasExistingBrowser = puppeteerBrowser !== null;
      
      if (hasExistingWindow || hasExistingBrowser) {
        console.log('⚠️  检测到已有登录窗口或浏览器实例，先关闭旧的');
        if (hasExistingWindow) {
          closeLoginWindow();
        }
        if (hasExistingBrowser) {
          try {
            await puppeteerBrowser.close();
            puppeteerBrowser = null;
          } catch (error) {
            console.error('关闭 Puppeteer 浏览器时出错:', error);
          }
        }
      }
      
      // 设置标志位，防止重复调用
      isOpeningLoginWindow = true;
      
      const useTokenGetter = options.useTokenGetter === true && pixivTokenGetter !== null; // 默认禁用，避免失败后自动弹第二个登录窗口
      const usePuppeteer = options.usePuppeteer !== false && puppeteer !== null; // 默认使用 Puppeteer（如果可用）
      const proxyConfig = options.proxy || null;
      
      // 优先使用 pixiv-token-getter
      if (useTokenGetter) {
        console.log('📞 收到打开登录窗口的请求（使用 pixiv-token-getter，推荐方法）');
        
        // 清除 code verifier（pixiv-token-getter 不需要）
        currentLoginCodeVerifier = null;
        isProcessingAuthCode = false;
        
        // 使用 pixiv-token-getter 进行登录（异步执行，不阻塞响应）
        loginWithPixivTokenGetter(proxyConfig)
          .then(async (loginInfo) => {
            console.log('✅ pixiv-token-getter 登录成功');
            
            // 清除 code verifier
            currentLoginCodeVerifier = null;
            isProcessingAuthCode = false;
            
            // 保存 token 到后端
            if (loginInfo && loginInfo.data && loginInfo.data.refreshToken) {
              await saveTokenToBackend(loginInfo.data.refreshToken);
            }
            
            // 通知主窗口登录成功
            // 使用标志位防止重复发送
            let eventSent = false;
            const sendLoginSuccessEvent = () => {
              // 如果事件已经发送成功，不再重复发送
              if (eventSent) {
                return;
              }
              
              if (mainWindow && !mainWindow.isDestroyed()) {
                const eventData = {
                  accessToken: loginInfo.data.accessToken,
                  refreshToken: loginInfo.data.refreshToken,
                  expiresIn: loginInfo.data.expiresIn,
                  user: loginInfo.data.user,
                };
                console.log('📤 发送 login-success 事件到主窗口:', {
                  hasRefreshToken: !!eventData.refreshToken,
                  hasAccessToken: !!eventData.accessToken,
                  windowReady: !mainWindow.isDestroyed(),
                });
                try {
                  mainWindow.webContents.send('login-success', eventData);
                  console.log('✅ login-success 事件已发送');
                  eventSent = true; // 标记为已发送
                  
                  // 如果事件发送成功，也可以尝试重新加载页面或导航到 dashboard
                  // 作为备选方案，等待 2 秒后检查是否需要手动导航
                  setTimeout(() => {
                    const currentUrl = mainWindow.webContents.getURL();
                    console.log('🔍 当前页面 URL:', currentUrl);
                    // 如果还在登录页面，尝试导航到 dashboard
                    if (currentUrl && currentUrl.includes('/login')) {
                      console.log('🔄 检测到仍在登录页面，尝试导航到 dashboard...');
                      mainWindow.webContents.executeJavaScript(`
                        if (window.location.pathname === '/login' || window.location.pathname.includes('/login')) {
                          window.location.href = '/dashboard';
                        }
                      `).catch(err => {
                        console.error('❌ 执行导航脚本失败:', err.message);
                      });
                    }
                  }, 2000);
                } catch (sendError) {
                  console.error('❌ 发送 login-success 事件失败:', sendError.message);
                  // 发送失败时不设置标志，允许重试
                }
              } else {
                console.error('❌ 主窗口不存在或已销毁，无法发送事件');
                // 窗口未准备好时不设置标志，允许重试
              }
            };
            
            // 立即尝试发送，如果页面未加载，延迟后重试（但只会发送一次）
            sendLoginSuccessEvent();
            setTimeout(sendLoginSuccessEvent, 500);
            setTimeout(sendLoginSuccessEvent, 1000);
          })
          .catch(async (error) => {
            console.error('❌ pixiv-token-getter 登录失败:', error);
            console.log('🔄 回退到 Puppeteer 登录...');
            
            // 清除 code verifier
            currentLoginCodeVerifier = null;
            isProcessingAuthCode = false;
            
            // 如果 pixiv-token-getter 失败，回退到 Puppeteer
            if (usePuppeteer) {
              try {
                // 生成 PKCE 参数
                const codeVerifier = generateCodeVerifier();
                const codeChallenge = generateCodeChallenge(codeVerifier);
                console.log('✅ PKCE 参数已生成');
                console.log('   Code Challenge:', codeChallenge);
                console.log('   Code Verifier (前20字符):', codeVerifier.substring(0, 20) + '...');
                
                // 保存 code verifier 供后续使用
                currentLoginCodeVerifier = codeVerifier;
                isProcessingAuthCode = false;
                
                // 使用 Puppeteer 进行登录（异步执行，不阻塞响应）
                loginWithPuppeteer(codeVerifier, codeChallenge, proxyConfig)
                  .then(async (loginInfo) => {
                    console.log('✅ Puppeteer 登录成功');
                    
                    // 清除 code verifier
                    currentLoginCodeVerifier = null;
                    isProcessingAuthCode = false;
                    
                    // 保存 token 到后端
                    if (loginInfo && loginInfo.data && loginInfo.data.refreshToken) {
                      await saveTokenToBackend(loginInfo.data.refreshToken);
                    }
                    
                    // 通知主窗口登录成功
                    // 使用标志位防止重复发送
                    let eventSent = false;
                    const sendLoginSuccessEvent = () => {
                      // 如果事件已经发送成功，不再重复发送
                      if (eventSent) {
                        return;
                      }
                      
                      if (mainWindow && !mainWindow.isDestroyed()) {
                        const eventData = {
                          accessToken: loginInfo.data.accessToken,
                          refreshToken: loginInfo.data.refreshToken,
                          expiresIn: loginInfo.data.expiresIn,
                          user: loginInfo.data.user,
                        };
                        console.log('📤 发送 login-success 事件到主窗口:', {
                          hasRefreshToken: !!eventData.refreshToken,
                          hasAccessToken: !!eventData.accessToken,
                          windowReady: !mainWindow.isDestroyed(),
                        });
                        try {
                          mainWindow.webContents.send('login-success', eventData);
                          console.log('✅ login-success 事件已发送');
                          eventSent = true; // 标记为已发送
                          resetLoginWindowFlag(); // 重置标志位
                          
                          setTimeout(() => {
                            const currentUrl = mainWindow.webContents.getURL();
                            console.log('🔍 当前页面 URL:', currentUrl);
                            if (currentUrl && currentUrl.includes('/login')) {
                              console.log('🔄 检测到仍在登录页面，尝试导航到 dashboard...');
                              mainWindow.webContents.executeJavaScript(`
                                if (window.location.pathname === '/login' || window.location.pathname.includes('/login')) {
                                  window.location.href = '/dashboard';
                                }
                              `).catch(err => {
                                console.error('❌ 执行导航脚本失败:', err.message);
                              });
                            }
                          }, 2000);
                        } catch (sendError) {
                          console.error('❌ 发送 login-success 事件失败:', sendError.message);
                          // 发送失败时不设置标志，允许重试
                        }
                      } else {
                        console.error('❌ 主窗口不存在或已销毁，无法发送事件');
                        // 窗口未准备好时不设置标志，允许重试
                      }
                    };
                    
                    // 立即尝试发送，如果页面未加载，延迟后重试（但只会发送一次）
                    sendLoginSuccessEvent();
                    setTimeout(sendLoginSuccessEvent, 500);
                    setTimeout(sendLoginSuccessEvent, 1000);
                  })
                  .catch(async (puppeteerError) => {
                    console.error('❌ Puppeteer 登录也失败:', puppeteerError);
                    
                    // 清除 code verifier
                    currentLoginCodeVerifier = null;
                    isProcessingAuthCode = false;
                    
                    // 通知主窗口登录失败
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.webContents.send('login-error', {
                        message: puppeteerError.message || 'Puppeteer 登录失败',
                        code: puppeteerError.code || 'PUPPETEER_LOGIN_ERROR'
                      });
                    }
                    resetLoginWindowFlag(); // 重置标志位
                  });
              } catch (fallbackError) {
                console.error('❌ 回退到 Puppeteer 时出错:', fallbackError);
                // 通知主窗口登录失败
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('login-error', {
                    message: error.message || 'pixiv-token-getter 登录失败，且无法回退到 Puppeteer',
                    code: error.code || 'TOKEN_GETTER_LOGIN_ERROR'
                  });
                }
                resetLoginWindowFlag(); // 重置标志位
              }
            } else {
              // 如果 Puppeteer 不可用，通知主窗口登录失败
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('login-error', {
                  message: error.message || 'pixiv-token-getter 登录失败，且 Puppeteer 不可用',
                  code: error.code || 'TOKEN_GETTER_LOGIN_ERROR'
                });
              }
              resetLoginWindowFlag(); // 重置标志位
            }
          });
        
        return { success: true, method: 'pixiv-token-getter' };
      } else if (usePuppeteer) {
        console.log('📞 收到打开登录窗口的请求（使用 Puppeteer）');
        
        // 生成 PKCE 参数
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        console.log('✅ PKCE 参数已生成');
        console.log('   Code Challenge:', codeChallenge);
        console.log('   Code Verifier (前20字符):', codeVerifier.substring(0, 20) + '...');
        
        // 保存 code verifier 供后续使用
        currentLoginCodeVerifier = codeVerifier;
        isProcessingAuthCode = false;
        
        // 使用 Puppeteer 进行登录（异步执行，不阻塞响应）
        loginWithPuppeteer(codeVerifier, codeChallenge, proxyConfig)
          .then(async (loginInfo) => {
            console.log('✅ Puppeteer 登录成功');
            
            // 清除 code verifier
            currentLoginCodeVerifier = null;
            isProcessingAuthCode = false;
            
            // 保存 token 到后端
            if (loginInfo && loginInfo.data && loginInfo.data.refreshToken) {
              await saveTokenToBackend(loginInfo.data.refreshToken);
            }
            
            // 通知主窗口登录成功
            // 使用标志位防止重复发送
            let eventSent = false;
            const sendLoginSuccessEvent = () => {
              // 如果事件已经发送成功，不再重复发送
              if (eventSent) {
                return;
              }
              
              if (mainWindow && !mainWindow.isDestroyed()) {
                const eventData = {
                  accessToken: loginInfo.data.accessToken,
                  refreshToken: loginInfo.data.refreshToken,
                  expiresIn: loginInfo.data.expiresIn,
                  user: loginInfo.data.user,
                };
                console.log('📤 发送 login-success 事件到主窗口:', {
                  hasRefreshToken: !!eventData.refreshToken,
                  hasAccessToken: !!eventData.accessToken,
                  windowReady: !mainWindow.isDestroyed(),
                });
                try {
                  mainWindow.webContents.send('login-success', eventData);
                  console.log('✅ login-success 事件已发送');
                  eventSent = true; // 标记为已发送
                  
                  // 如果事件发送成功，也可以尝试重新加载页面或导航到 dashboard
                  // 作为备选方案，等待 2 秒后检查是否需要手动导航
                  setTimeout(() => {
                    const currentUrl = mainWindow.webContents.getURL();
                    console.log('🔍 当前页面 URL:', currentUrl);
                    // 如果还在登录页面，尝试导航到 dashboard
                    if (currentUrl && currentUrl.includes('/login')) {
                      console.log('🔄 检测到仍在登录页面，尝试导航到 dashboard...');
                      mainWindow.webContents.executeJavaScript(`
                        if (window.location.pathname === '/login' || window.location.pathname.includes('/login')) {
                          window.location.href = '/dashboard';
                        }
                      `).catch(err => {
                        console.error('❌ 执行导航脚本失败:', err.message);
                      });
                    }
                  }, 2000);
                } catch (sendError) {
                  console.error('❌ 发送 login-success 事件失败:', sendError.message);
                  // 发送失败时不设置标志，允许重试
                }
              } else {
                console.error('❌ 主窗口不存在或已销毁，无法发送事件');
                // 窗口未准备好时不设置标志，允许重试
              }
            };
            
            // 立即尝试发送，如果页面未加载，延迟后重试（但只会发送一次）
            sendLoginSuccessEvent();
            setTimeout(sendLoginSuccessEvent, 500);
            setTimeout(sendLoginSuccessEvent, 1000);
          })
          .catch(async (error) => {
            console.error('❌ Puppeteer 登录失败:', error);
            
            // 清除 code verifier
            currentLoginCodeVerifier = null;
            isProcessingAuthCode = false;
            
            // 通知主窗口登录失败
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('login-error', {
                message: error.message || 'Puppeteer 登录失败',
                code: error.code || 'PUPPETEER_LOGIN_ERROR'
              });
            }
            resetLoginWindowFlag(); // 重置标志位
          });
        
        return { 
          success: true, 
          message: 'Puppeteer 登录窗口已打开，请完成登录。',
          windowOpened: true,
          method: 'puppeteer'
        };
      } else {
        // pixiv-token-getter 和 Puppeteer 都不可用，返回错误
        console.error('❌ pixiv-token-getter 和 Puppeteer 都不可用，无法进行登录');
        resetLoginWindowFlag(); // 重置标志位
        
        return {
          success: false,
          error: 'pixiv-token-getter 和 Puppeteer 都不可用。请确保已安装 pixiv-token-getter 或 puppeteer-core。',
          code: 'NO_LOGIN_METHOD_AVAILABLE'
        };
      }
    } catch (error) {
      console.error('❌ 打开登录窗口失败:', error);
      console.error('错误堆栈:', error.stack);
      
      // 清除 code verifier
      currentLoginCodeVerifier = null;
      isProcessingAuthCode = false;
      
      // 通知主窗口登录失败
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('login-error', {
          message: error.message || '打开登录窗口失败',
          code: error.code || 'UNKNOWN_ERROR'
        });
      }
      
      resetLoginWindowFlag(); // 重置标志位
      return { success: false, error: error.message };
    }
  });

  // 关闭登录窗口
  ipcMain.handle('close-login-window', async () => {
    // 关闭 BrowserWindow 登录窗口
    if (loginWindow) {
      closeLoginWindow();
    }
    
    // 关闭 Puppeteer 浏览器
    if (puppeteerBrowser) {
      try {
        await puppeteerBrowser.close();
        puppeteerBrowser = null;
        console.log('✅ Puppeteer 浏览器已关闭');
      } catch (error) {
        console.error('❌ 关闭 Puppeteer 浏览器时出错:', error);
      }
    }
    
    // 清除 code verifier
    currentLoginCodeVerifier = null;
    isProcessingAuthCode = false;
    
    if (loginWindow || puppeteerBrowser) {
      return { success: true };
    }
    return { success: false, error: '登录窗口不存在' };
  });

  // 窗口控制 IPC 处理程序
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window-close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });
}

// createWindow 函数已移至 windowService.createWindow()
// 使用 windowService.createWindow(isDev, backendService.actualBackendPort) 创建窗口

// 应用准备就绪
app.whenReady().then(() => {
  console.log('🚀 Electron 应用准备就绪');
  console.log(`📦 运行模式: ${isDev ? '开发模式' : '生产模式'}`);
  console.log(`📁 __dirname: ${__dirname}`);
  if (isDev) {
    console.log(`📁 项目根目录: ${getProjectRoot()}`);
  } else {
    console.log(`📁 resourcesPath: ${process.resourcesPath}`);
  }
  
  // 初始化应用数据目录（开发模式和生产模式都初始化，确保数据一致性）
  // 这样可以确保开发和生产环境使用相同的数据目录，避免数据混乱
  appData = initializeAppData();
  if (appData) {
    console.log(`✅ 应用数据目录已初始化: ${appData.appDataDir}`);
    console.log(`📁 配置文件路径: ${appData.configPath}`);
    console.log(`📁 数据目录: ${appData.dataDir}`);
    console.log(`📁 下载目录: ${appData.downloadsDir}`);
  } else {
    console.error('❌ 无法初始化应用数据目录');
  }
  
  // 初始化 IPC 处理程序（在创建窗口之前）
  setupIpcHandlers();
  
  // 立即创建窗口，避免白屏
  mainWindow = windowService.createWindow(isDev, backendService.actualBackendPort);
  
  // 启动后端服务器
  startBackend();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = windowService.createWindow(isDev, backendService.actualBackendPort);
    }
  });
});

// 所有窗口关闭时
app.on('window-all-closed', () => {
  // macOS 上通常应用会保持运行
  if (process.platform !== 'darwin') {
    isAppClosing = true;
    setLoggerAppClosing(true);
    setTimersAppClosing(true);
    backendService.setAppClosing(true);
    clearAllTimers();
    // stopBackend 现在是 async 函数，但在应用关闭时我们不需要等待
    stopBackend().catch(err => {
      safeError('停止后端进程时出错:', err);
    });
    app.quit();
  }
});

// 应用退出前
app.on('before-quit', () => {
  isAppClosing = true;
  setLoggerAppClosing(true);
  setTimersAppClosing(true);
  backendService.setAppClosing(true);
  clearAllTimers();
  stopBackend();
});

// 窗口状态管理已移至 windowService

// 处理协议（可选：自定义协议如 pixivflow://）
app.setAsDefaultProtocolClient('pixivflow');
