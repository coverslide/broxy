#!/usr/bin/env node

var fs = require('fs')
var path = require('path')

var app = require('commander')
var bouncy = require('bouncy')

module.exports = broxy

broxy.main = main
broxy.init = init

function main(){
  app.usage('[options] [broxy.json]')
    .option('-k, --key-file <filename>', 'key file')
    .option('-c, --cert-file <filename>', 'cert file')
    .option('-f, --forward <port>', 'port to forward to')
    .option('-h, --host <hostname>', 'hostname to forward to')
    .option('-p, --port <port>', 'port to listen on')
    .option('-a, --address <address>', 'ip address to listen on')
    .option('-s, --secure-port <port>', 'port to listen to secure traffic from')
    .option('-A, --secure-address <address>', 'port to listen to secure traffic from')
    .option('-u, --setuid <uid>', 'uid to drop permissions to')
    .option('-g, --setgid <gid>', 'gid to drop permissions to')
    .parse(process.argv)  

  var configFile = app.args[0] || 'broxy.json'

  var configPath = path.resolve(configFile)

  if(fs.existsSync(configPath))
    config = require(configPath)
  else
    config = {}

  ;['keyFile', 'certFile', 'key', 'cert', 'forward', 'port', 'address', 'securePort', 'secureAddress', 'setuid', 'setgid'].forEach(function(key){
    if(app[key])
      config[key] = app[key]
  })

  configDir = path.dirname(configPath)

  if(!config.port)
    config.port = 80
  if(!config.securePort)
    config.securePort = 443

  if(config.keyFile)
    config.key = fs.readFileSync(path.resolve(configDir, config.keyFile))
  if(config.certFile)
    config.cert = fs.readFileSync(path.resolve(configDir, config.certFile))

  var proxies = init(config)

  proxies.proxy && proxies.proxy.listen(config.port, config.address)
  proxies.secureProxy && proxies.secureProxy.listen(config.securePort, config.secureAddress)

  if(config.setgid)
    process.setgid(config.setgid)

  if(config.setuid)
    process.setuid(config.setuid)

  return proxies
}

function init(config){
  if(config.key && config.cert){
    var secureProxy = broxy({
      key: config.key
      , cert: config.cert
      , forward: config.forward
      , host: config.host
      , domains: config.domains
    })
  }

  var proxy = broxy({
    forward: config.forward
    , host: config.host
    , domains: config.domains
  })

  return {proxy: proxy, secureProxy: secureProxy}
}

//mostly useless on its own
function broxy(config){

  var onrequest = config.domains
  ? function onrequest(req, res, bounce){
    var route = config.domains[req.headers.host]
    if(route){
      if(Array.isArray(route)){
        var lastroute = route.pop()
        route.unshift(lastroute)
        route = lastroute
      }
      var b = bounce(route.socket || route.port || route, route.host)
      b.on('error', function(e){
        res.statusCode = 503
        res.setHeader('content-type', 'text/html')
        res.end('<h1>503 Service Unavailable</h1>')
      })
    } else {
      res.statusCode = 502
      res.setHeader('content-type', 'text/html')
      res.end('<h1>502 Bad Gateway</h1>')
    }
  }
  : function onrequest(req, res, bounce){
    var b = bounce(config.forward, config.host)
    b.on('error', function(e){
      res.statusCode = 503
      res.setHeader('content-type', 'text/html')
      res.end('<h1>502 Service Unavailable</h1>')
    })
  }

  if(config.key && config.cert){
    var server = bouncy({key: config.key, cert: config.cert}, onrequest)
  }
  else{
    var server = bouncy(onrequest)
  }

  return server
}

if(require.main == module){
  main()
}
