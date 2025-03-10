const crypto = require('crypto');
const axios = require('axios');

// 微信配置
const wxConfig = {
    appId: 'wxecb4b49bbd803d21',
    appSecret: '1718b38efd9de2eeb74917cc72b224b3'
};

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
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wxConfig.appId}&secret=${wxConfig.appSecret}`;
    console.log('Access token URL:', url);

    try {
        const response = await axios.get(url);
        console.log('Access token full response:', response);
        console.log('Access token response data:', response.data);

        if (response.data.access_token) {
            accessTokenCache.token = response.data.access_token;
            accessTokenCache.expires = now + (response.data.expires_in * 1000) - 60000;
            return response.data.access_token;
        } else {
            const error = new Error('Failed to get access_token');
            error.response = response.data;
            throw error;
        }
    } catch (error) {
        console.error('Error getting access_token:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            url: url
        });
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
    console.log('Jsapi ticket URL:', url);

    try {
        const response = await axios.get(url);
        console.log('Jsapi ticket full response:', response);
        console.log('Jsapi ticket response data:', response.data);

        if (response.data.ticket) {
            jsapiTicketCache.ticket = response.data.ticket;
            jsapiTicketCache.expires = now + (response.data.expires_in * 1000) - 60000;
            return response.data.ticket;
        } else {
            const error = new Error('Failed to get jsapi_ticket');
            error.response = response.data;
            throw error;
        }
    } catch (error) {
        console.error('Error getting jsapi_ticket:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            url: url
        });
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
    console.log('Function started with event:', event);
    
    // 允许跨域请求
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // 处理 OPTIONS 请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const url = event.queryStringParameters?.url;
        console.log('Received URL:', url);
        
        if (!url) {
            throw new Error('URL parameter is required');
        }

        // 清理URL（移除hash部分）
        const cleanUrl = url.split('#')[0];
        console.log('Cleaned URL:', cleanUrl);

        const accessToken = await getAccessToken();
        console.log('Got access_token:', accessToken);

        const jsapiTicket = await getJsapiTicket(accessToken);
        console.log('Got jsapi_ticket:', jsapiTicket);

        const nonceStr = generateNonceStr();
        const timestamp = Math.floor(Date.now() / 1000);

        const signature = generateSignature(jsapiTicket, nonceStr, timestamp, cleanUrl);

        const responseData = {
            appId: wxConfig.appId,
            timestamp: timestamp,
            nonceStr: nonceStr,
            signature: signature,
            url: cleanUrl // 添加用于调试
        };

        console.log('Final response data:', responseData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };
    } catch (error) {
        console.error('Error in wx-sign function:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status
        });

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                details: error.response?.data || error.stack,
                url: event.queryStringParameters?.url
            })
        };
    }
}; 