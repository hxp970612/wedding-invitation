const crypto = require('crypto');

// 微信配置
const config = {
    appId: 'wxecb4b49bbd803d21', // 替换为你的 AppID
    appSecret: '1718b38efd9de2eeb74917cc72b224b3' // 替换为你的 AppSecret
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
    // 按字典序排序参数
    const params = {
        jsapi_ticket: jsapiTicket,
        noncestr: noncestr,
        timestamp: timestamp,
        url: url.split('#')[0] // 去除 URL 中的 hash 部分
    };
    
    const str = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    return crypto.createHash('sha1').update(str).digest('hex');
}

exports.handler = async function(event, context) {
    try {
        // 只接受 POST 请求
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }

        const { url } = JSON.parse(event.body);

        console.log("url:{}", url)
        
        // 获取必要的参数
        const accessToken = await getAccessToken();
        console.log("accessToken:{}", accessToken)
        const jsapiTicket = await getJsApiTicket(accessToken);
        console.log("jsapiTicket:{}", jsapiTicket)
        const noncestr = Math.random().toString(36).slice(2, 17); // 使用 slice 替代 substr
        console.log("noncestr:{}", noncestr)
        const timestamp = Math.floor(Date.now() / 1000);

        // 生成签名
        const signature = generateSignature(jsapiTicket, noncestr, timestamp, url);
        console.log("signature:{}", signature)

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