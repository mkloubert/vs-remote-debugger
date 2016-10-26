# vs-remote-debugger

![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/mkloubert.vs-remote-debugger.svg)
![Installs](https://vsmarketplacebadge.apphb.com/installs/mkloubert.vs-remote-debugger.svg)
![Rating](https://vsmarketplacebadge.apphb.com/rating-short/mkloubert.vs-remote-debugger.svg)

[Visual Studio Code](https://code.visualstudio.com/) (VS Code) extension that makes it easy to debug code on a remote host by using a generic way.

## Why?

In many scenarios you are not able to install debuggers like [XDebug](https://xdebug.org/).

Another (additional) reason could be that you and your constributors work on the same server for different reasons.

This is why you need a simple way to debug your code in VS Code on many systems with an optional list of constributors and the possibility to send data over a TCP socket.

## How does it work?

The extension listens on a TCP port and waits for binary packages (debug messages) which contain UTF-8 formatted JSON data with all debug information that should be displayed in your editor.

The system / server you would like to debug has to send these information to your debugger instance when it is executed.

The extension stores these information and makes it possible to switch between all recived debug messages.

![Install screenshot 3](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-3.png)

## Install

Launch VS Code Quick Open (Ctrl+P), paste the following command, and press enter:

```bash
ext install vs-remote-debugger
```

Open the root directory of the project you would like to debug and select the environment `Generic Remote Debugger`:

![Install screenshot 1](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-1.png)

Customize the initial configuration (if needed):

![Install screenshot 2](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-2.png)

And start debugging:

![Install screenshot 3](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-3.png)

## Usage

### PHP

Install the [RemoteDebugger.php](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/classes/MJK/Diagnostics/RemoteDebugger.php) in your application.

If you look at the [example code](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/test.php) you can see how the class can be used:

```php
$debugger = new \MJK\Diagnostics\RemoteDebugger();
$debugger->addHost("my.remote.host.or.ip", 23979);

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
