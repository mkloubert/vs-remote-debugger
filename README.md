# vs-remote-debugger

![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/mkloubert.vs-remote-debugger.svg)
![Installs](https://vsmarketplacebadge.apphb.com/installs/mkloubert.vs-remote-debugger.svg)
![Rating](https://vsmarketplacebadge.apphb.com/rating-short/mkloubert.vs-remote-debugger.svg)

Visual Studio Code extension that makes it easy to debug code on a remote host by using a generic way.

## Install

Launch VS Code Quick Open (Ctrl+P), paste the following command, and press enter:

```bash
ext install vs-remote-debugger
```

Open the root directory of the project you would like to debug and select the environment `Generic Remote Debugger`:

![Install screenshot 1](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-1.png)

Customize the initial configuration (if needed):

![Install screenshot 1](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-2.png)

And start debugging:

![Install screenshot 2](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-3.png)

## Usage PHP

Install the [RemoteDebugger.php](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/classes/MJK/Diagnostics/RemoteDebugger.php) in your application.

If you look at the [example code](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/test.php) you can see how the class can be used:

```php
$debugger = new \MJK\Diagnostics\RemoteDebugger();
$debugger->addHost("my.remote.host.or.ip", 5979);

// send the information you want to debug
$debugger->dbg([
    'a' => date('Y-m-d H:i:s'),
    'b' => 1,
    'c' => 2.34,
    'd' => 'Marcel K! Marcel K! Marcel K!',
    'e' => false,
    'f' => null,
    'g' => true,
]);
```
