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

  //
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
    })
  }

  var proxy = broxy({
    forward: config.forward
    , host: config.host
  })

  return {proxy: proxy, secureProxy: secureProxy}
}

//mostly useless on its own
function broxy(config){

  function onrequest(req, bounce){
    bounce(config.forward, config.host)
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
