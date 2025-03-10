const crypto = require('crypto');

// 微信配置
const config = {
    appId: 'YOUR_APP_ID', // 替换为你的 AppID
    appSecret: 'YOUR_APP_SECRET' // 替换为你的 AppSecret
};

// 获取微信 access_token
async function getAccessToken() {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appId}&secret=${config.appSecret}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.access_token;
}

// 获取 jsapi_ticket
async function getJsApiTicket(accessToken) {
    const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;
    const response = await fetch(url);
    const data = await response.json();
    return data.ticket;
}

// 生成签名
function generateSignature(jsapiTicket, noncestr, timestamp, url) {
    const str = `jsapi_ticket=${jsapiTicket}&noncestr=${noncestr}&timestamp=${timestamp}&url=${url}`;
    return crypto.createHash('sha1').update(str).digest('hex');
}

exports.handler = async function(event, context) {
    try {
        // 只接受 POST 请求
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }

        const { url } = JSON.parse(event.body);
        
        // 获取必要的参数
        const accessToken = await getAccessToken();
        const jsapiTicket = await getJsApiTicket(accessToken);
        const noncestr = Math.random().toString(36).substr(2, 15);
        const timestamp = Math.floor(Date.now() / 1000);

        // 生成签名
        const signature = generateSignature(jsapiTicket, noncestr, timestamp, url);

        // 返回配置信息
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                appId: config.appId,
                nonceStr: noncestr,
                timestamp: timestamp,
                signature: signature
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
} 