#!/usr/bin/env node

'use strict'

var fs = require('fs')
var path = require('path')

var app = require('commander')
var httpProxy = require('http-proxy')

module.exports = broxy

broxy.main = main
broxy.init = init

function main(){
  app.usage('[options] [broxy.json]')
    .option('-k, --key-file <filename>', 'key file')
    .option('-c, --cert-file <filename>', 'cert file')
    .option('-f, --forward <port>', 'port to forward to')
    .option('-a, --address <address>', 'address to forward to')
    .option('-p, --port <port>', 'port to listen on (Defaults to 80)')
    .option('-h, --host <host>', 'host to listen on (Defaults to 0.0.0.0)')
    .option('-P, --secure-port <port>', 'port to listen to secure traffic from (Defaults to 443)')
    .option('-H, --secure-host <host>', 'port to listen to secure traffic from (Defaults to 0.0.0.0)')
    .option('-u, --setuid <uid>', 'uid to drop permissions to')
    .option('-g, --setgid <gid>', 'gid to drop permissions to')
    .option('-l, --log-file [file]', 'file to log to')
    .option('-L, --log-format <format>', 'logging format')
    .parse(process.argv)  

  var configFile = app.args[0] || 'broxy.json'

  var configPath = path.resolve(configFile)

  if(fs.existsSync(configPath))
    var config = require(configPath)
  else
    var config = {}

  ;['keyFile', 'certFile', 'key', 'cert', 'forward', 'port', 'address', 'securePort', 'secureHost', 'setuid', 'setgid', 'logFile', 'logFormat'].forEach(function(key){
    if(app[key])
      config[key] = app[key]
  })

  var configDir = path.dirname(configPath)

  if(!config.port)
    config.port = 80
  if(!config.securePort)
    config.securePort = 443

  if(config.keyFile)
    config.key = fs.readFileSync(path.resolve(configDir, config.keyFile))
  if(config.certFile)
    config.cert = fs.readFileSync(path.resolve(configDir, config.certFile))

  var proxies = init(config)

  proxies.proxy && proxies.proxy.listen(config.port, config.host)
  proxies.secureProxy && proxies.secureProxy.listen(config.securePort, config.secureHost)

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
      , address: config.address
      , domains: config.domains
      , logFile: config.logFile
      , logFormat: config.logFormat
    })
  }

  var proxy = broxy({
    forward: config.forward
    , address: config.address
    , domains: config.domains
    , logFile: config.logFile
    , logFormat: config.logFormat
  })

  return {proxy: proxy, secureProxy: secureProxy}
}

//mostly useless on its own
function broxy(config){
  var onrequest = null
  if(config.domains){

    var cache = {}
    var regDomains = Object.keys(config.domains).filter(function(domain){
      return /\*/.test(domain)
    }).map(function(domain){
      return [new RegExp('^' + domain.replace(/\*/g,'[^.]+') + '$'), config.domains[domain]]
    })
    var onrequest = function onrequest(req, res, proxy){
      var host = req.headers.host.split(':')[0]
      var route = resolveRoute(host)
      if(route){
        cache[host] = route
        if(Array.isArray(route)){
          var lastroute = route.pop()
          route.unshift(lastroute)
          route = lastroute
        }
        proxy.proxyRequest(req, res, createRoute(route))
      } else {
        res.statusCode = 502
        res.setHeader('content-type', 'text/html')
        res.end('<h1>502 Bad Gateway</h1>')
      }
    }

    var onupgrade = function onupgrade(req, socket, head){
      var host = req.headers.host.split(':')[0]
      var route = resolveRoute(host)
      if(route){
        cache[host] = route
        if(Array.isArray(route)){
          var lastroute = route.pop()
          route.unshift(lastroute)
          route = lastroute
        }
        server.proxy.proxyWebSocketRequest(req, socket, head, createRoute(route))
      } else {
        res.statusCode = 502
        res.setHeader('content-type', 'text/html')
        res.end('<h1>502 Bad Gateway</h1>')
      }
    }
  } else {
    var onrequest = function onrequest(req, res, proxy){
      proxy.proxyRequest(req, res, {
        host: config.address,
        port: config.forward
      })
    }

    var onupgrade = function onupgrade(req, socket, head){
      server.proxy.proxyWebSocketRequest(req, socket, head, {
        host: config.address,
        port: config.forward
      })
    }
  }

  if(config.key && config.cert){
    var server = httpProxy.createServer({key: config.key, cert: config.cert}, onrequest)
  }
  else{
    var server = httpProxy.createServer(onrequest)
  }

  server.on('upgrade', onupgrade)

  if(config.logFile){
    var logFile = config.logFile
    if(logFile === true){
      //if the value of logfile is simply true, use stdout instead
      var logStream = fs.createWriteStream('', {flags:'a', fd: process.stdout.fd})
    } else {
      var logStream = fs.createWriteStream(logFile, {flags:'a'})
    }
    var logFormat = config.logFormat || '%d\t%p\t%i\t%h\t%u\t%a\t%U'
    var log = function(req){
      logStream.write(parseLogFormat(logFormat, !!config.key, req) + '\n')
    }
    server.on('request', log)
    server.on('upgrade', log)
  }

  return server

  function createRoute(route){
    if(typeof route == 'string'){
      return {socketPath: route}
    } else if(typeof route == 'number'){
      return {port: route, host: '127.0.0.1'}
    } else {
      return route
    }
  }

  function resolveRoute(host){
    var route = cache[host]
    if(!route){
      route = config.domains[host]
      if(!route){
        regDomains.some(function(reg){
          if(reg[0].test(host)){
            route = reg[1]
            return true
          }
        })
        if(!route && config.domains['*']){
          route = config.domains['*']
        }
      }
    }
    return route
  }
}

function parseLogFormat(fmt, secure, req){
  var str = fmt
  //TODO: look into how apache does its logs
  str = str.replace(/%d/g, new Date())
  str = str.replace(/%p/g, secure ? 'HTTPS' : 'HTTP')
  str = str.replace(/%i/g, req.socket.remoteAddress)
  str = str.replace(/%h/g, req.headers.host)
  str = str.replace(/%u/g, req.url)
  str = str.replace(/%a/g, req.headers['user-agent'])
  str = str.replace(/%U/g, req.headers['upgrade'] || '')
  return str
}

if(require.main == module){
  main()
}
