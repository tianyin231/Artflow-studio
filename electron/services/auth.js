/**
 * 认证登录服务模块
 * 处理 Pixiv 登录相关的所有功能
 */

const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');
const axios = require('axios');
const { BrowserWindow, dialog } = require('electron');
const { safeLog, safeError } = require('../utils/logger');
const { safeSetTimeout, safeSetInterval } = require('../utils/timers');

// Pixiv OAuth 常量
const PIXIV_CLIENT_ID = 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
const PIXIV_CLIENT_SECRET = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';
const PIXIV_REDIRECT_URI = 'https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback';
const PIXIV_LOGIN_URL = 'https://app-api.pixiv.net/web/v1/login';
const PIXIV_AUTH_TOKEN_URL = 'https://oauth.secure.pixiv.net/auth/token';
const PIXIV_USER_AGENT = 'PixivIOSApp/7.13.3 (iOS 14.6; iPhone13,2)';

// 尝试加载可选依赖
let puppeteer = null;
try {
  puppeteer = require('puppeteer-core');
  safeLog('✅ Puppeteer-core 已加载');
} catch (error) {
  safeLog('⚠️  Puppeteer-core 未安装');
}

let pixivTokenGetter = null;
let pixivTokenGetterAdapter = null;
try {
  pixivTokenGetter = require('pixiv-token-getter');
  // 尝试加载适配器
  const possiblePaths = [
    path.join(__dirname, '../../dist/pixiv-token-getter-adapter.js'),
    path.join(process.cwd(), 'dist/pixiv-token-getter-adapter.js'),
    path.join(process.resourcesPath || '', 'dist/pixiv-token-getter-adapter.js'),
  ];
  
  for (const adapterPath of possiblePaths) {
    if (adapterPath && fs.existsSync(adapterPath)) {
      pixivTokenGetterAdapter = require(adapterPath);
      safeLog('✅ pixiv-token-getter 适配器已加载');
      break;
    }
  }
  
  if (!pixivTokenGetterAdapter) {
    safeLog('✅ pixiv-token-getter 已加载（直接使用）');
  }
} catch (error) {
  safeLog('⚠️  pixiv-token-getter 未安装');
}

class AuthService {
  constructor() {
    this.loginWindow = null;
    this.puppeteerBrowser = null;
    this.currentLoginCodeVerifier = null;
    this.loginUrlCheckInterval = null;
    this.currentLoadTimeout = null;
    this.isOpeningLoginWindow = false;
    this.isProcessingAuthCode = false;
  }

  /**
   * 生成 PKCE code verifier
   */
  generateCodeVerifier() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < 128; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成 PKCE code challenge
   */
  generateCodeChallenge(verifier) {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return hash.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * 查找系统 Chrome/Chromium 可执行文件路径
   */
  findChromeExecutable() {
    const platform = process.platform;
    const possiblePaths = [];

    if (platform === 'darwin') {
      possiblePaths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
        path.join(os.homedir(), 'Applications', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      );
    } else if (platform === 'win32') {
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

    for (const chromePath of possiblePaths) {
      try {
        if (fs.existsSync(chromePath)) {
          safeLog(`✅ 找到 Chrome/Chromium: ${chromePath}`);
          return chromePath;
        }
      } catch (error) {
        // 忽略文件系统错误
      }
    }

    safeLog('⚠️  未找到系统 Chrome/Chromium，Puppeteer 将尝试使用默认路径');
    return null;
  }

  /**
   * 使用 pixiv-token-getter 进行登录
   */
  async loginWithPixivTokenGetter(proxyConfig) {
    if (!pixivTokenGetter) {
      throw new Error('pixiv-token-getter 未安装，无法使用 pixiv-token-getter 登录');
    }

    try {
      safeLog('🚀 开始使用 pixiv-token-getter 登录...');
      
      // 检查是否有适配器可用
      if (pixivTokenGetterAdapter && pixivTokenGetterAdapter.loginWithPixivTokenGetterInteractive) {
        safeLog('📦 使用适配器进行登录...');
        const loginInfo = await pixivTokenGetterAdapter.loginWithPixivTokenGetterInteractive(proxyConfig);
        
        if (!loginInfo) {
          throw new Error('pixiv-token-getter 登录失败：返回结果为空');
        }
        
        // 转换格式以匹配 Electron 的期望格式
        return {
          success: true,
          data: {
            accessToken: loginInfo.access_token || loginInfo.accessToken,
            refreshToken: loginInfo.refresh_token || loginInfo.refreshToken,
            expiresIn: loginInfo.expires_in || loginInfo.expiresIn,
            tokenType: loginInfo.token_type || loginInfo.tokenType || 'bearer',
            user: loginInfo.user || {},
          },
        };
      } else {
        // 直接使用 pixiv-token-getter
        safeLog('📦 直接使用 pixiv-token-getter 进行登录...');
        
        // 注意：pixiv-token-getter 不支持代理配置，但我们可以继续
        if (proxyConfig && proxyConfig.enabled) {
          safeLog('⚠️  pixiv-token-getter 不支持代理配置，将不使用代理');
        }
        
        const { getTokenInteractive } = pixivTokenGetter;
        const tokenInfo = await getTokenInteractive({
          headless: false,
          timeout: 300000, // 5 分钟
          onBrowserOpen: () => {
            safeLog('🌐 浏览器已打开，请完成登录...');
          },
          onPageReady: (page, url) => {
            safeLog(`📱 登录页面已就绪: ${url}`);
          },
        });
        
        // 转换格式
        const user = tokenInfo.user || {};
        return {
          success: true,
          data: {
            accessToken: tokenInfo.access_token,
            refreshToken: tokenInfo.refresh_token,
            expiresIn: tokenInfo.expires_in,
            tokenType: tokenInfo.token_type || 'bearer',
            user: {
              id: user.id || '',
              name: user.name || '',
              account: user.account || '',
              profile_image_urls: user.profile_image_urls || {
                px_16x16: '',
                px_50x50: '',
                px_170x170: '',
              },
              mail_address: user.mail_address || '',
              is_premium: user.is_premium || false,
              x_restrict: user.x_restrict || 0,
              is_mail_authorized: user.is_mail_authorized || false,
              require_policy_agreement: user.require_policy_agreement || false,
            },
          },
        };
      }
    } catch (error) {
      safeError('❌ pixiv-token-getter 登录失败:', error);
      throw error;
    }
  }

  /**
   * 使用 Puppeteer 进行登录（Electron 环境）
   * 注意：此方法需要 buildProxyUrl 和 exchangeCodeForToken 辅助函数
   */
  async loginWithPuppeteer(codeVerifier, codeChallenge, proxyConfig) {
    if (!puppeteer) {
      throw new Error('Puppeteer-core 未安装，无法使用 Puppeteer 登录');
    }

    let browser = null;
    
    try {
      safeLog('[object Object]Puppeteer 登录...');
      
      // 构建登录 URL
      const loginParams = new URLSearchParams({
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        client: 'pixiv-android',
      });
      const loginUrl = `${PIXIV_LOGIN_URL}?${loginParams.toString()}`;
      
      safeLog('🌐 登录 URL:', loginUrl);
      
      // 配置 Puppeteer 启动选项
      const launchOptions = {
        headless: false, // 显示浏览器窗口
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
        ],
        ignoreHTTPSErrors: true,
      };
      
      // 尝试查找系统 Chrome
      const chromeExecutable = this.findChromeExecutable();
      if (chromeExecutable) {
        launchOptions.executablePath = chromeExecutable;
      }
      
      // 添加代理配置
      if (proxyConfig && proxyConfig.enabled) {
        const proxyUrl = this.buildProxyUrl(proxyConfig);
        if (proxyUrl) {
          launchOptions.args.push(`--proxy-server=${proxyUrl}`);
          safeLog(`🔌 使用代理: ${proxyUrl}`);
        }
      }
      
      // 启动浏览器
      safeLog('🌐 正在启动浏览器...');
      browser = await puppeteer.launch(launchOptions);
      this.puppeteerBrowser = browser; // 保存浏览器实例以便后续关闭
      safeLog('✅ 浏览器已启动');
      
      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();
      
      // 设置 User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 设置额外的 HTTP 头
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });
      
      // 导航到登录页面
      safeLog('📱 正在打开登录页面...');
      try {
        await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      } catch (error) {
        safeLog('⚠️  networkidle2 超时，尝试 domcontentloaded...');
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
      
      safeLog('✅ 登录页面已打开');
      safeLog('👤 请在浏览器窗口中完成登录...');
      
      // 等待授权码（最多 5 分钟）
      const code = await this.waitForAuthCodePuppeteer(page, 300000);
      
      if (!code) {
        // 再次尝试从当前 URL 提取 code
        const currentUrl = page.url();
        safeLog(`🔍 当前页面 URL: ${currentUrl}`);
        
        try {
          const urlObj = new URL(currentUrl);
          const codeFromUrl = urlObj.searchParams.get('code');
          if (codeFromUrl) {
            safeLog('✅ 从当前 URL 中找到授权码');
            const loginInfo = await this.exchangeCodeForToken(codeFromUrl, codeVerifier);
            await browser.close();
            browser = null;
            return loginInfo;
          }
        } catch (e) {
          // URL 解析失败
        }
        
        throw new Error('未能获取授权码。登录可能已取消或超时，请重试。');
      }
      
      safeLog('✅ 授权码已获取');
      safeLog('🔄 正在交换 token...');
      
      // 交换 code 获取 token
      const loginInfo = await this.exchangeCodeForToken(code, codeVerifier);
      
      safeLog('✅ 登录成功！');
      
      // 关闭浏览器
      try {
        await browser.close();
        browser = null;
        this.puppeteerBrowser = null;
      } catch (e) {
        safeLog('⚠️  关闭浏览器时出错，但登录已成功');
      }
      
      return loginInfo;
    } catch (error) {
      safeError('❌ Puppeteer 登录失败:', error);
      
      // 清理资源
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          // 忽略清理错误
        }
        this.puppeteerBrowser = null;
      }
      
      throw error;
    }
  }

  /**
   * 等待 Puppeteer 页面中的授权码
   */
  waitForAuthCodePuppeteer(page, timeoutMs) {
    return new Promise((resolve) => {
      let resolved = false;
      let pollInterval = null;
      
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        try {
          page.off('response', onResponse);
          page.off('framenavigated', onFrameNavigated);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        } catch (e) {
          // 忽略清理错误
        }
      };
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          cleanup();
          safeLog('⏱️  等待授权码超时');
          resolve(null);
        }
      }, timeoutMs);
      
      const checkUrlForCode = (url) => {
        try {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          if (code) {
            safeLog('✅ 在 URL 中找到授权码');
            return code;
          }
        } catch (e) {
          // 无效 URL，忽略
        }
        return null;
      };
      
      // 立即检查当前 URL
      try {
        const currentUrl = page.url();
        const currentCode = checkUrlForCode(currentUrl);
        if (currentCode) {
          cleanup();
          clearTimeout(timeout);
          resolve(currentCode);
          return;
        }
      } catch (e) {
        // 继续使用监听器
      }
      
      // 监听响应事件
      const onResponse = async (response) => {
        if (resolved) return;
        try {
          const url = response.url();
          const code = checkUrlForCode(url);
          if (code) {
            cleanup();
            clearTimeout(timeout);
            resolve(code);
          }
        } catch (e) {
          // 忽略错误
        }
      };
      
      // 监听导航事件
      const onFrameNavigated = async (frame) => {
        if (resolved || frame !== page.mainFrame()) return;
        try {
          const url = frame.url();
          const code = checkUrlForCode(url);
          if (code) {
            cleanup();
            clearTimeout(timeout);
            resolve(code);
          }
        } catch (e) {
          // 忽略错误
        }
      };
      
      // 定期轮询 URL
      pollInterval = setInterval(async () => {
        if (resolved) {
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          return;
        }
        
        try {
          const url = page.url();
          const code = checkUrlForCode(url);
          if (code) {
            cleanup();
            clearTimeout(timeout);
            resolve(code);
          }
        } catch (e) {
          // 忽略错误
        }
      }, 1000); // 每秒检查一次
      
      // 设置监听器
      page.on('response', onResponse);
      page.on('framenavigated', onFrameNavigated);
    });
  }

  /**
   * 使用授权码交换 token
   */
  async exchangeCodeForToken(code, codeVerifier, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2秒
    
    try {
      safeLog(`🔄 正在交换 token (尝试 ${retryCount + 1}/${MAX_RETRIES + 1})...`);
      
      const response = await axios.post(
        PIXIV_AUTH_TOKEN_URL,
        new URLSearchParams({
          client_id: PIXIV_CLIENT_ID,
          client_secret: PIXIV_CLIENT_SECRET,
          code: code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          include_policy: 'true',
          redirect_uri: PIXIV_REDIRECT_URI,
        }).toString(),
        {
          headers: {
            'user-agent': PIXIV_USER_AGENT,
            'app-os-version': '14.6',
            'app-os': 'ios',
            'content-type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000,
          validateStatus: (status) => status >= 200 && status < 300,
        }
      );
      
      // 验证响应数据
      if (!response.data) {
        throw new Error('Token 交换响应数据为空');
      }
      
      if (!response.data.access_token || !response.data.refresh_token) {
        throw new Error('Token 交换响应缺少必要的 token 字段');
      }
      
      safeLog('✅ Token 交换成功');
      
      return {
        success: true,
        data: {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresIn: response.data.expires_in,
          tokenType: response.data.token_type || 'bearer',
          scope: response.data.scope || '',
          user: response.data.user,
        },
      };
    } catch (error) {
      safeError('❌ Token 交换失败:', error.message);
      
      // 如果是网络错误且未达到最大重试次数，尝试重试
      if (retryCount < MAX_RETRIES) {
        const isNetworkError = 
          !error.response && 
          (error.code === 'ECONNABORTED' || 
           error.code === 'ETIMEDOUT' || 
           error.code === 'ENOTFOUND' ||
           error.message.includes('timeout') ||
           error.message.includes('Network Error'));
        
        if (isNetworkError) {
          safeLog(`🔄 网络错误，将在 ${RETRY_DELAY / 1000} 秒后重试...`);
          await new Promise(resolve => safeSetTimeout(resolve, RETRY_DELAY));
          return this.exchangeCodeForToken(code, codeVerifier, retryCount + 1);
        }
      }
      
      // 如果是 HTTP 错误，提供更详细的错误信息
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const data = error.response.data;
        
        safeError(`   HTTP 状态: ${status} ${statusText}`);
        if (data) {
          safeError(`   响应数据: ${JSON.stringify(data)}`);
        }
        
        // 根据状态码提供更具体的错误信息
        if (status === 400) {
          throw new Error(`Token 交换失败: 请求参数错误 (${statusText})。授权码可能已过期或无效。`);
        } else if (status === 401) {
          throw new Error(`Token 交换失败: 认证失败 (${statusText})。请检查客户端 ID 和密钥。`);
        } else if (status === 500) {
          throw new Error(`Token 交换失败: 服务器错误 (${statusText})。请稍后重试。`);
        } else {
          throw new Error(`Token 交换失败: ${status} ${statusText}`);
        }
      }
      
      // 其他错误
      throw new Error(`Token 交换失败: ${error.message}`);
    }
  }

  /**
   * 构建代理 URL 字符串
   */
  buildProxyUrl(proxyConfig) {
    if (!proxyConfig || !proxyConfig.enabled || !proxyConfig.host || !proxyConfig.port) {
      return '';
    }
    
    const protocol = proxyConfig.protocol || 'http';
    const host = proxyConfig.host;
    const port = proxyConfig.port;
    
    // 构建代理 URL
    let proxyUrl = `${protocol}://`;
    
    // 如果有用户名和密码，添加到 URL 中
    if (proxyConfig.username && proxyConfig.password) {
      proxyUrl += `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@`;
    }
    
    proxyUrl += `${host}:${port}`;
    
    return proxyUrl;
  }

  /**
   * 创建登录窗口
   * 注意：此方法非常复杂，包含大量的事件监听和错误处理
   * 由于代码量很大，这里只提供一个简化版本
   * 完整实现需要从原始 main.cjs 中提取
   */
  createLoginWindow(codeVerifier, codeChallenge) {
    // TODO: 从 main.cjs 中提取完整的 createLoginWindow 实现
    // 这个函数非常复杂，包含大量的事件监听和错误处理
    throw new Error('createLoginWindow 尚未实现，需要从 main.cjs 中提取');
  }

  /**
   * 关闭登录窗口
   */
  closeLoginWindow() {
    // 清理超时计时器
    if (this.currentLoadTimeout) {
      clearTimeout(this.currentLoadTimeout);
      this.currentLoadTimeout = null;
    }
    
    // 清理URL检查定时器
    if (this.loginUrlCheckInterval) {
      clearInterval(this.loginUrlCheckInterval);
      this.loginUrlCheckInterval = null;
    }
    
    if (this.loginWindow) {
      try {
        safeLog('🔒 正在关闭登录窗口...');
        if (!this.loginWindow.isDestroyed()) {
          this.loginWindow.close();
        }
      } catch (e) {
        safeError('⚠️  关闭登录窗口时出错:', e.message);
      } finally {
        this.loginWindow = null;
      }
    }
    
    // 停止轮询
    if (this.loginUrlCheckInterval) {
      clearInterval(this.loginUrlCheckInterval);
      this.loginUrlCheckInterval = null;
    }
    
    // 清除状态
    this.currentLoginCodeVerifier = null;
    this.isProcessingAuthCode = false;
  }
}

module.exports = new AuthService();
