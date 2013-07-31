broxy
=====

simple bouncy based console app for launching a single proxy

Installation
============

```
  npm -g install broxy
```

Usage
=====

```
  Usage: broxy [options] [broxy.json]

  Options:

    -h, --help                  output usage information
    -k, --key-file <filename>   key file
    -c, --cert-file <filename>  cert file
    -f, --forward <port>        port to forward to
    -a, --address <address>     address to forward to
    -p, --port <port>           port to listen on (Defaults to 80)
    -h, --host <host>           host to listen on (Defaults to 0.0.0.0)
    -P, --secure-port <port>    port to listen to secure traffic from (Defaults to 443)
    -H, --secure-host <host>    port to listen to secure traffic from (Defaults to 0.0.0.0)
    -u, --setuid <uid>          uid to drop permissions to
    -g, --setgid <gid>          gid to drop permissions to
    -l, --log-file [file]       file to log to
    -L, --log-format <format>   logging format
```
