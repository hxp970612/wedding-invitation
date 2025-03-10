const crypto = require('crypto');
const axios = require('axios');

// 用于存储 access_token 和 jsapi_ticket
let accessTokenCache = {
  token: null,
  expires: 0
};

let jsapiTicketCache = {
  ticket: null,
  expires: 0
};

// 生成随机字符串
function generateNonceStr(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 获取 access_token
async function getAccessToken() {
  const now = Date.now();
  if (accessTokenCache.token && now < accessTokenCache.expires) {
    console.log('Using cached access_token');
    return accessTokenCache.token;
  }

  console.log('Fetching new access_token from WeChat API');
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;

  try {
    const response = await axios.get(url);
    console.log('Access token response:', response.data);

    if (response.data.access_token) {
      accessTokenCache.token = response.data.access_token;
      accessTokenCache.expires = now + (response.data.expires_in * 1000) - 60000; // 提前1分钟过期
      return response.data.access_token;
    } else {
      throw new Error('Failed to get access_token: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('Error getting access_token:', error.message);
    throw error;
  }
}

// 获取 jsapi_ticket
async function getJsapiTicket(accessToken) {
  const now = Date.now();
  if (jsapiTicketCache.ticket && now < jsapiTicketCache.expires) {
    console.log('Using cached jsapi_ticket');
    return jsapiTicketCache.ticket;
  }

  console.log('Fetching new jsapi_ticket from WeChat API');
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;

  try {
    const response = await axios.get(url);
    console.log('Jsapi ticket response:', response.data);

    if (response.data.ticket) {
      jsapiTicketCache.ticket = response.data.ticket;
      jsapiTicketCache.expires = now + (response.data.expires_in * 1000) - 60000; // 提前1分钟过期
      return response.data.ticket;
    } else {
      throw new Error('Failed to get jsapi_ticket: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('Error getting jsapi_ticket:', error.message);
    throw error;
  }
}

// 生成签名
function generateSignature(ticket, noncestr, timestamp, url) {
  const str = `jsapi_ticket=${ticket}&noncestr=${noncestr}&timestamp=${timestamp}&url=${url}`;
  console.log('String to sign:', str);
  const signature = crypto.createHash('sha1').update(str).digest('hex');
  console.log('Generated signature:', signature);
  return signature;
}

exports.handler = async function(event, context) {
  // 允许跨域请求
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // 记录请求信息
  console.log('Request query:', event.queryStringParameters);
  console.log('Request headers:', event.headers);

  try {
    const url = event.queryStringParameters.url;
    if (!url) {
      throw new Error('URL parameter is required');
    }

    const accessToken = await getAccessToken();
    const jsapiTicket = await getJsapiTicket(accessToken);
    const nonceStr = generateNonceStr();
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = generateSignature(jsapiTicket, nonceStr, timestamp, url);

    const responseData = {
      appId: process.env.WECHAT_APP_ID,
      timestamp: timestamp,
      nonceStr: nonceStr,
      signature: signature
    };

    console.log('Response data:', responseData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    };
  } catch (error) {
    console.error('Error in wx-sign function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
}; 