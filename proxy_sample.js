module.exports = {
    "endpoints": [
        {
            "path": "test1",
            "switch_type": "header",
            "switch_refid": "testid",
            "strategy": {
                "demo1": {
                    "proxy_url": "http://httpbin.org",
                    "proxy_key": false
                }
            }
        },
        {
            "path": "test2",
            "switch_type": "direct",
            "methods": ["GET"],
            "strategy": {
                "url": {
                    "proxy_url": "http://httpbin.org/ip"
                }
            }
        }
    ]
}