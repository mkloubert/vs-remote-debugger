# vs-remote-debugger

![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/mkloubert.vs-remote-debugger.svg)
![Installs](https://vsmarketplacebadge.apphb.com/installs/mkloubert.vs-remote-debugger.svg)
![Rating](https://vsmarketplacebadge.apphb.com/rating-short/mkloubert.vs-remote-debugger.svg)

[Visual Studio Code](https://code.visualstudio.com/) (VS Code) extension that makes it easy to debug code on a remote host by using a generic way.

## Why?

In many scenarios you are not able to install debuggers like [XDebug](https://xdebug.org/).

Another (additional) reason could be that you and your constributors work on the same server for different reasons.

This is why you need a simple way to debug your code in VS Code on many systems with an optional list of constributors and the possibility to send data over a TCP socket to you.

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

### No library found?

The implementation of such a debugger message is quite simple.

The first 4 bytes store the length of the JSON data. It represents an unsinged 32-bit value in little endian order. In [Node.js](https://nodejs.org/en/) it looks like this:

```typescript
// 'debuggerMessage' is a Buffer object
let jsonLength = debuggerMessage.readUInt32LE(0);
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

Look at the following interfaces in the [debugger.ts](https://github.com/mkloubert/vs-remote-debugger/blob/master/src/debugger.ts) to get an idea how a message is structured:

| Name | Description |
| ---- | --------- |
| RemoteDebuggerEntry | The whole JSON message. |
| RemoteDebuggerThread | A thread. |
| RemoteDebuggerStackFrame | A frame of a stacktrace. |
| RemoteDebuggerScope | A scope of a stack frame. |
| RemoteDebuggerVariable | A variable. |

If you run the [test.php](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/test.php) script from the PHP SDK, a possible message can look like this:

```json
{
  // RemoteDebuggerThread
  "t": [
    {
      "i": 1,
      "n": "Thread #1"
    }
  ],
  "s": [
    // RemoteDebuggerStackFrame
    {
      "i": 1,
      "ln": "M:\\VS Code\\proj\\vs-remote-debugger\\sdk\\php\\test.php",
      "f": "/test.php",
      "fn": "test.php",
      "l": 31,
      "n": "MJK\\Diagnostics\\RemoteDebugger->dbg()",
      // RemoteDebuggerScope
      "s": [
        {
          "n": "Current function",
          "r": 7,
          "v": [
            // RemoteDebuggerVariable
            {
              "n": "$vars",
              "r": 8,
              "t": "array",
              "v": [
                {
                  "n": "[a]",
                  "r": 0,
                  "t": "string",
                  "v": "2016-10-26 18:18:48"
                },
                {
                  "n": "[b]",
                  "r": 0,
                  "t": "integer",
                  "v": "1"
                },
                {
                  "n": "[c]",
                  "r": 0,
                  "t": "float",
                  "v": "2.34"
                },
                {
                  "n": "[d]",
                  "r": 0,
                  "t": "string",
                  "v": "Marcel K! Marcel K! Marcel K!"
                },
                {
                  "n": "[e]",
                  "r": 0,
                  "t": "string",
                  "v": "false"
                },
                {
                  "n": "[f]",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "[g]",
                  "r": 0,
                  "t": "string",
                  "v": "true"
                },
                {
                  "n": "[h]",
                  "r": 9,
                  "t": "array",
                  "v": [
                    {
                      "n": "[h1]",
                      "r": 0,
                      "t": "integer",
                      "v": "0"
                    },
                    {
                      "n": "[h2]",
                      "r": 0,
                      "t": "float",
                      "v": "1.2"
                    },
                    {
                      "fn": "{closure}",
                      "n": "[h3]",
                      "r": 10,
                      "t": "function",
                      "v": [
                        {
                          "n": "&$A",
                          "r": 0,
                          "t": "string",
                          "v": "(mixed)"
                        },
                        {
                          "n": "$B",
                          "r": 0,
                          "t": "string",
                          "v": "(callable)"
                        },
                        {
                          "n": "[$C]",
                          "r": 0,
                          "t": "string",
                          "v": "(array)"
                        }
                      ]
                    }
                  ]
                },
                {
                  "on": "stdClass",
                  "n": "[i]",
                  "r": 11,
                  "t": "object",
                  "v": [
                    {
                      "n": "$i1",
                      "r": 0,
                      "t": "float",
                      "v": "0.1"
                    },
                    {
                      "n": "$i2",
                      "r": 0,
                      "t": "string",
                      "v": "123"
                    }
                  ]
                },
                {
                  "n": "[j]",
                  "r": 12,
                  "t": "array",
                  "v": [
                    {
                      "n": "[0]",
                      "r": 0,
                      "t": "string",
                      "v": "MK"
                    },
                    {
                      "n": "[1]",
                      "r": 0,
                      "t": "string",
                      "v": "TM"
                    }
                  ]
                },
                {
                  "fn": "{closure}",
                  "n": "[k]",
                  "r": 13,
                  "t": "function",
                  "v": [
                    {
                      "n": "$a",
                      "r": 0,
                      "t": "string",
                      "v": "(mixed)"
                    },
                    {
                      "n": "$b",
                      "r": 0,
                      "t": "string",
                      "v": "(callable)"
                    },
                    {
                      "n": "[&$c]",
                      "r": 0,
                      "t": "string",
                      "v": "(array)"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "n": "Debugger",
          "r": 1
        }
      ]
    },
    {
      "i": 2,
      "ln": "M:\\VS Code\\proj\\vs-remote-debugger\\sdk\\php\\test.php",
      "f": "/test.php",
      "fn": "test.php",
      "l": 57,
      "n": "test_function()",
      "s": [
        {
          "n": "Current function",
          "r": 14,
          "v": [
            {
              "on": "MJK\\Diagnostics\\RemoteDebugger",
              "n": "$debugger",
              "r": 15,
              "t": "object",
              "v": [
                {
                  "n": "$_hostProviders",
                  "r": 16,
                  "t": "array",
                  "v": [
                    {
                      "fn": "MJK\\Diagnostics\\{closure}",
                      "n": "[0]",
                      "r": 17,
                      "t": "function",
                      "v": []
                    }
                  ]
                },
                {
                  "n": "$App",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "$CurrentFunctionStackFrame",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "$CurrentFunctionVariable",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "$CurrentThread",
                  "r": 18,
                  "t": "array",
                  "v": [
                    {
                      "n": "[0]",
                      "r": 0,
                      "t": "integer",
                      "v": "1"
                    },
                    {
                      "n": "[1]",
                      "r": 0,
                      "t": "string",
                      "v": "Thread #1"
                    }
                  ]
                },
                {
                  "n": "$DebuggerStackFrame",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "$DefaultHost",
                  "r": 0,
                  "t": "string",
                  "v": "127.0.0.1"
                },
                {
                  "n": "$DefaultPort",
                  "r": 0,
                  "t": "integer",
                  "v": "5979"
                },
                {
                  "n": "$DefaultTimeout",
                  "r": 0,
                  "t": "integer",
                  "v": "5"
                },
                {
                  "n": "$EntryFilter",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "fn": "{closure}",
                  "n": "$ErrorHandler",
                  "r": 19,
                  "t": "function",
                  "v": [
                    {
                      "n": "$type",
                      "r": 0,
                      "t": "string",
                      "v": "(mixed)"
                    },
                    {
                      "n": "$err",
                      "r": 0,
                      "t": "string",
                      "v": "(mixed)"
                    },
                    {
                      "n": "$eventData",
                      "r": 0,
                      "t": "string",
                      "v": "(mixed)"
                    }
                  ]
                },
                {
                  "n": "$ScriptRoot",
                  "r": 0,
                  "t": "string",
                  "v": "M:\\VS Code\\proj\\vs-remote-debugger\\sdk\\php"
                },
                {
                  "n": "$TargetClient",
                  "r": 0,
                  "t": "string",
                  "v": null
                }
              ]
            }
          ]
        },
        {
          "n": "Debugger",
          "r": 1
        }
      ]
    },
    {
      "i": 3,
      "ln": "M:\\VS Code\\proj\\vs-remote-debugger\\sdk\\php\\test1.inc.php",
      "f": "/test1.inc.php",
      "fn": "test1.inc.php",
      "l": 13,
      "n": "MyClass::staticTestMethod()",
      "s": [
        {
          "n": "Current function",
          "r": 20,
          "v": [
            {
              "on": "MJK\\Diagnostics\\RemoteDebugger",
              "n": "$debugger",
              "r": 21,
              "t": "object",
              "v": [
                {
                  "n": "$_hostProviders",
                  "r": 22,
                  "t": "array",
                  "v": [
                    {
                      "fn": "MJK\\Diagnostics\\{closure}",
                      "n": "[0]",
                      "r": 23,
                      "t": "function",
                      "v": []
                    }
                  ]
                },
                {
                  "n": "$App",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "$CurrentFunctionStackFrame",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "$CurrentFunctionVariable",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "$CurrentThread",
                  "r": 24,
                  "t": "array",
                  "v": [
                    {
                      "n": "[0]",
                      "r": 0,
                      "t": "integer",
                      "v": "1"
                    },
                    {
                      "n": "[1]",
                      "r": 0,
                      "t": "string",
                      "v": "Thread #1"
                    }
                  ]
                },
                {
                  "n": "$DebuggerStackFrame",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "n": "$DefaultHost",
                  "r": 0,
                  "t": "string",
                  "v": "127.0.0.1"
                },
                {
                  "n": "$DefaultPort",
                  "r": 0,
                  "t": "integer",
                  "v": "5979"
                },
                {
                  "n": "$DefaultTimeout",
                  "r": 0,
                  "t": "integer",
                  "v": "5"
                },
                {
                  "n": "$EntryFilter",
                  "r": 0,
                  "t": "string",
                  "v": null
                },
                {
                  "fn": "{closure}",
                  "n": "$ErrorHandler",
                  "r": 25,
                  "t": "function",
                  "v": [
                    {
                      "n": "$type",
                      "r": 0,
                      "t": "string",
                      "v": "(mixed)"
                    },
                    {
                      "n": "$err",
                      "r": 0,
                      "t": "string",
                      "v": "(mixed)"
                    },
                    {
                      "n": "$eventData",
                      "r": 0,
                      "t": "string",
                      "v": "(mixed)"
                    }
                  ]
                },
                {
                  "n": "$ScriptRoot",
                  "r": 0,
                  "t": "string",
                  "v": "M:\\VS Code\\proj\\vs-remote-debugger\\sdk\\php"
                },
                {
                  "n": "$TargetClient",
                  "r": 0,
                  "t": "string",
                  "v": null
                }
              ]
            }
          ]
        },
        {
          "n": "Debugger",
          "r": 1
        }
      ]
    },
    {
      "i": 4,
      "ln": "M:\\VS Code\\proj\\vs-remote-debugger\\sdk\\php\\test.php",
      "f": "/test.php",
      "fn": "test.php",
      "l": 61,
      "n": "require",
      "s": [
        {
          "n": "Current function",
          "r": 26,
          "v": [
            {
              "n": "(arg0)",
              "r": 0,
              "t": "string",
              "v": "M:\\VS Code\\proj\\vs-remote-debugger\\sdk\\php\\test1.inc.php"
            }
          ]
        },
        {
          "n": "Debugger",
          "r": 1
        }
      ]
    }
  ],
  "v": [
    // RemoteDebuggerVariable
    {
      "n": "$a",
      "r": 0,
      "t": "string",
      "v": "2016-10-26 18:18:48"
    },
    {
      "n": "$b",
      "r": 0,
      "t": "integer",
      "v": "1"
    },
    {
      "n": "$c",
      "r": 0,
      "t": "float",
      "v": "2.34"
    },
    {
      "n": "$d",
      "r": 0,
      "t": "string",
      "v": "Marcel K! Marcel K! Marcel K!"
    },
    {
      "n": "$e",
      "r": 0,
      "t": "string",
      "v": "false"
    },
    {
      "n": "$f",
      "r": 0,
      "t": "string",
      "v": null
    },
    {
      "n": "$g",
      "r": 0,
      "t": "string",
      "v": "true"
    },
    {
      "n": "$h",
      "r": 2,
      "t": "array",
      "v": [
        {
          "n": "[h1]",
          "r": 0,
          "t": "integer",
          "v": "0"
        },
        {
          "n": "[h2]",
          "r": 0,
          "t": "float",
          "v": "1.2"
        },
        {
          "fn": "{closure}",
          "n": "[h3]",
          "r": 3,
          "t": "function",
          "v": [
            {
              "n": "&$A",
              "r": 0,
              "t": "string",
              "v": "(mixed)"
            },
            {
              "n": "$B",
              "r": 0,
              "t": "string",
              "v": "(callable)"
            },
            {
              "n": "[$C]",
              "r": 0,
              "t": "string",
              "v": "(array)"
            }
          ]
        }
      ]
    },
    {
      "on": "stdClass",
      "n": "$i",
      "r": 4,
      "t": "object",
      "v": [
        {
          "n": "$i1",
          "r": 0,
          "t": "float",
          "v": "0.1"
        },
        {
          "n": "$i2",
          "r": 0,
          "t": "string",
          "v": "123"
        }
      ]
    },
    {
      "n": "$j",
      "r": 5,
      "t": "array",
      "v": [
        {
          "n": "[0]",
          "r": 0,
          "t": "string",
          "v": "MK"
        },
        {
          "n": "[1]",
          "r": 0,
          "t": "string",
          "v": "TM"
        }
      ]
    },
    {
      "fn": "{closure}",
      "n": "$k",
      "r": 6,
      "t": "function",
      "v": [
        {
          "n": "$a",
          "r": 0,
          "t": "string",
          "v": "(mixed)"
        },
        {
          "n": "$b",
          "r": 0,
          "t": "string",
          "v": "(callable)"
        },
        {
          "n": "[&$c]",
          "r": 0,
          "t": "string",
          "v": "(array)"
        }
      ]
    }
  ]
}
```
