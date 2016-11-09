# vs-remote-debugger

![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/mkloubert.vs-remote-debugger.svg)
![Installs](https://vsmarketplacebadge.apphb.com/installs/mkloubert.vs-remote-debugger.svg)
![Rating](https://vsmarketplacebadge.apphb.com/rating-short/mkloubert.vs-remote-debugger.svg)

[Visual Studio Code](https://code.visualstudio.com/) (VS Code) extension that makes it easy to debug code on a remote host by using a generic way.

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=GFV9X2A64ZK3Y)

## License

[MIT license](https://github.com/mkloubert/vs-remote-debugger/blob/master/LICENSE)

## Why?

In many scenarios you are not able to install debuggers like [XDebug](https://xdebug.org/).

Another (additional) reason could be, that you and your constributors work on the same server for different reasons.

This is why you need a simple way to debug your code in VS Code on many systems with an optional list of constributors and the possibility to send data over a TCP socket to you.

## How does it work?

The extension listens on a TCP port and waits for binary packages (debug messages) which contain UTF-8 formatted JSON data with all debug information that should be displayed in your editor.

The system / server you would like to debug has to send these information to your debugger instance when it is executed.

The extension stores these information and makes it possible to switch between all received debug messages.

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

A common way is to use [Composer](https://getcomposer.org/) to install anything via [Packagist.org](https://packagist.org/packages/mkloubert/vs-remote-debugger):

```bash
composer require mkloubert/vs-remote-debugger
```

If you look at the [example code](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/tests/test1.inc.php) you can see how the class can be used:

```php
$debugger = new \MJK\Diagnostics\RemoteDebugger();
$debugger->addHost("my.remote.host.or.ip", 23979);

// compress JSON data with GZIP
// 
// activate the "gzip" plugin in your
// launch.json file in VS Code!
$debugger->JsonTransformer = function($json) {
    return @\gzencode($json);
};

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

### No library found?

The implementation of such a debugger message is quite simple.

The first 4 bytes store the length of the JSON data. It represents an unsinged 32-bit value in little endian order. In [Node.js](https://nodejs.org/en/) it looks like this:

```typescript
// 'binaryPackage' is a Buffer object
let jsonLength = binaryPackage.readUInt32LE(0);
```

The rest contains the JSON data with the debug information:

```typescript
// at offset 4, the JSON data starts
let json = binaryPackage.toString('utf8',
                                  4,
                                  jsonLength + 4);
                                 
// RemoteDebuggerEntry (s. below or 'debugger.ts')
let debugMessage: RemoteDebuggerEntry = JSON.parse(json);
```

Look at the following interfaces in the [contracts.ts](https://github.com/mkloubert/vs-remote-debugger/blob/master/src/contracts.ts) to get an idea how a message is structured:

| Name | Description |
| ---- | --------- |
| RemoteDebuggerEntry | The whole JSON message. |
| RemoteDebuggerThread | A thread. |
| RemoteDebuggerStackFrame | A frame of a stacktrace. |
| RemoteDebuggerScope | A scope of a stack frame. |
| RemoteDebuggerVariable | A variable. |

Additional you should look at the [RemoteDebugger](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/classes/MJK/Diagnostics/RemoteDebugger.php) class to see how a server machine sends data to Visual Studio Code.


If you run the [test.php](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/tests/test.php) script from the PHP SDK, a possible message can look like this:

* [example.json](https://github.com/mkloubert/vs-remote-debugger/blob/master/example.json)

### Debugger console

If the debugger instance is running, you can use the "Debugger console" (CTRL + SHIFT + Y) of VS Code which provides a lot of handy and useful commands:
 
![Install screenshot 3](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-4.png)

Input `?` inside your "command field" if you would like to display all available commands that are provided by the debugger.

A complete list of commands with detailed descriptions and examples, can be found at the [wiki](https://github.com/mkloubert/vs-remote-debugger/wiki#commands) or you can use the [help command](https://github.com/mkloubert/vs-remote-debugger/wiki/command_help) in the debugger console to open a wiki page directly.
