# vs-remote-debugger

![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/mkloubert.vs-remote-debugger.svg)
![Installs](https://vsmarketplacebadge.apphb.com/installs/mkloubert.vs-remote-debugger.svg)
![Rating](https://vsmarketplacebadge.apphb.com/rating-short/mkloubert.vs-remote-debugger.svg)

[Visual Studio Code](https://code.visualstudio.com/) (VS Code) extension that makes it easy to debug code on a remote host by using a generic way.

## License

[MIT license](https://github.com/mkloubert/vs-remote-debugger/blob/master/LICENSE)

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

Additional you should look at the [RemoteDebugger](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/classes/MJK/Diagnostics/RemoteDebugger.php) class to see how a server machine sends data to Visual Studio Code.

If you run the [test.php](https://github.com/mkloubert/vs-remote-debugger/blob/master/sdk/php/test.php) script from the PHP SDK, a possible message can look like this:

* [example.json](https://github.com/mkloubert/vs-remote-debugger/blob/master/example.json)

### Debugger console

If the debugger instance is running, you can use the "Debugger console" (CTRL + SHIFT + Y) of VS Code which provides a lot of handy and useful commands:
 
![Install screenshot 3](https://raw.githubusercontent.com/mkloubert/vs-remote-debugger/master/img/readme-ss-4.png)

Input `?` inside your "command field" if you would like to display all available commands that are provided by the debugger.

#### Display messages

Input `list` to display the first 50 messages:

```
Total number of entries: 12
[1] /test.php (31)
    From:  '::ffff:127.0.0.1:56843' (2016-10-30 14:29:40)
[2] /test.php (35)
    From:  '::ffff:127.0.0.1:56844' (2016-10-30 14:29:40)
[3] /test.php (31)
    From:  '::ffff:127.0.0.1:56847' (2016-10-30 14:29:41)
[4] /test.php (35)
    From:  '::ffff:127.0.0.1:56848' (2016-10-30 14:29:41)
[5] /test.php (31)
    From:  '::ffff:127.0.0.1:56850' (2016-10-30 14:29:42)
[6] /test.php (35)
    From:  '::ffff:127.0.0.1:56851' (2016-10-30 14:29:42)
[7] /test.php (31)
    From:  '::ffff:127.0.0.1:56853' (2016-10-30 14:29:43)
[8] /test.php (35)
    From:  '::ffff:127.0.0.1:56854' (2016-10-30 14:29:43)
[9] /test.php (31)
    From:  '::ffff:127.0.0.1:56856' (2016-10-30 14:29:43)
[10] /test.php (35)
     From:  '::ffff:127.0.0.1:56857' (2016-10-30 14:29:43)
[11] /test.php (31)
     From:  '::ffff:127.0.0.1:56859' (2016-10-30 14:29:44)
[12] /test.php (35)
     From:  '::ffff:127.0.0.1:56860' (2016-10-30 14:29:44)
```

To skip the first 8 entries, e.g., you can input `list 8`:

```
Total number of entries: 12
[9] /test.php (31)
    From:  '::ffff:127.0.0.1:56856' (2016-10-30 14:29:43)
[10] /test.php (35)
     From:  '::ffff:127.0.0.1:56857' (2016-10-30 14:29:43)
[11] /test.php (31)
     From:  '::ffff:127.0.0.1:56859' (2016-10-30 14:29:44)
[12] /test.php (35)
     From:  '::ffff:127.0.0.1:56860' (2016-10-30 14:29:44)
```

If you want to display the entries 3-7 only, simply input `list 2 5` (skip the first `2` entries and display `5` elements):

```
Total number of entries: 12
[3] /test.php (31)
    From:  '::ffff:127.0.0.1:56847' (2016-10-30 14:29:41)
[4] /test.php (35)
    From:  '::ffff:127.0.0.1:56848' (2016-10-30 14:29:41)
[5] /test.php (31)
    From:  '::ffff:127.0.0.1:56850' (2016-10-30 14:29:42)
[6] /test.php (35)
    From:  '::ffff:127.0.0.1:56851' (2016-10-30 14:29:42)
[7] /test.php (31)
    From:  '::ffff:127.0.0.1:56853' (2016-10-30 14:29:43)
```

#### Jump between messages / search

##### Jump

Use the `goto` command to select a specific message:

```
goto 2
New index: 2
```

The following commands provide shortcuts for `goto`:

| Name | Description |
| ---- | --------- |
| `+` | Goto to next message. |
| `-` | Goto to previous message. |
| `first` | Goto to FIRST message. |
| `last` | Goto to LAST message. |

If you want to know what message is currently selected, use `current`:

```
current
Current index: 2
```

##### Search

Use the `find` command to search for strings inside the "Debugger variables". The following example searches for values that contain `Tanja` and `Kloubert`: 

```
find tanja kloubert
Found 1 variables in entry 2: $D
```

Another kind of search is to use a regular expression by using `regex` command:

```
regex (2016\-01\-)
Found 1 variables in entry 2: $A
```

To jump to the next match, simply input `next`.

#### Additional information

##### Notes

`set` stores additional information inside a message. Select the message that should contain that kind of information and define a text:

```
goto 2
New index: 2
set Hello I am a note for second entry!
Set information for 2: Hello I am a note for second entry!
```

Now you see that note in the list of message:

```
list
Total number of entries: 2
[1] /test.php (31)
    From:  '::ffff:127.0.0.1:57074' (2016-10-30 14:46:19)
[2] /test.php (35)
    Notes: Hello I am a note for second entry!
    From:  '::ffff:127.0.0.1:57075' (2016-10-30 14:46:19)
```

If you would like to remove information from one or more entries, simply use `unset`:

| Input | Description |
| ---- | --------- |
| `unset` | Removes information from current message. |
| `unset 1` | Removes information from message 1. |
| `unset 2-7` | Removes information from messages 2 to 7. |
| `unset 4-` | Removes information from messages beginning at 4. |
| `unset 8,3-7,9` | Removes information from messages 8, 3-7 and 9. |

##### Logging

You also can store log entries inside messages by using `log`. Select the entry you would like to 'log' and define a message:

```
goto 1
New index: 1
log This is a log message for entry nr. 1
Add log for 1
log This is a 2nd log message for entry one
Add log for 1
```

`history` displays the logs of one or more entry:

```
history 1

[1] /test.php (31)
    #1 [2016-10-30 15:00:56] - mkloubert
       This is a log message for entry nr. 1
    #2 [2016-10-30 15:01:00] - mkloubert
       This is a 2nd log message for entry one
```

The values next to the timestamps (`mkloubert`) can be changed by setting the *nick* property in the *configurations* section of your *launch.json* file.

Examples:

| Input | Description |
| ---- | --------- |
| `history` | Displays logs of current message. |
| `history 1000` | Displays logs of message 1000. |
| `history 3-5` | Displays logs of messages 3 to 5. |
| `history 5-` | Displays logs of messages beginning at 5. |
| `history 12,6-8,2` | Displays logs of messages 12, 6-8 and 2. |

#### Pause the debugger

You can set the debugger in *pause mode*, what means that all messages you receive will be dropped instead of adding them to your list.

Use the `pause` command to switch to that mode:

```
pause
Paused
```

Leave the mode with `continue`:

```
continue
Running
```

Change current state with `toggle`:

```
toggle
Paused
toggle
Running
```

And last but not least, display the current state by using `state`:

```
state
Paused
```

##### Automatic switch

###### Counter

You can use a counter to switch to *pause mode* automatically. The command `counter 100`, e.g., will switch after `100` messages have been loaded:

```
counter 100
Enabled counter with 100 and continued debugging

...

[vs-remote-debugger] Counter is 0. Switched to 'pause' mode!
```

You also can reset and disable the counter by using `reset` and `disable` commands:

```
reset
Reset counter to 1 and continued debugging
disable
Disabled counter and continued debugging
```

All commands support the optional `pause` argument:

```
counter 1 pause
Enabled counter with 1 and switch to 'pause' mode
reset pause
Reset counter to 2 and switch to 'pause' mode
disable pause
Disabled counter and switch to 'pause' mode
```

If you simply input `counter` or `counter pause`, the debugger will use the value defined in the *counter* property (*configurations* sections) of your *launch.json* file:

```json
{
    "version": "0.24.0",
    "configurations": [
        {
            // ...
            
            "counter": 1234,
            
            // ...
        }
    ]
}
```

Example:

```
counter
Enabled counter with 1234 and continued debugging
counter pause
Enabled counter with 1234 and switch to 'pause' mode
```

#### Work with favorites

You can mark one or more message as favorite. Select the message you would like to mark and enter `add`:

```
goto 1
New index: 1
add
The following 1 favorites were added: 1
```

Examples:

| Input | Description |
| ---- | --------- |
| `add 59` | Adds message 59 as favorite. |
| `add 1-12` | Adds message 1 to 12 as favorites. |
| `add 3-` | Adds all messages as favorites beginning at 3. |
| `add 9,18-20,23979` | Adds messages 9, 18-20 and 23979 as favorites. |

Input `favs` to display your current favorites:

```
favs
Total number of favorites: 2
[1] /test.php (31)
    From:  '::ffff:127.0.0.1:57157' (2016-10-30 15:00:38)
[3] /test.php (31)
    From:  '::ffff:127.0.0.1:57300' (2016-10-30 15:19:45)
```

##### Saving and loading

###### Save to file

`save` saves your favorites to a JSON file:

```
save
Saved favorites to 'm:\VS Code\proj\vs-remote-debugger\sdk\php\vsrd_favs_1477841896882.json'
```

The command supports an optional `$FILE` argument:

```
save favs/myfavs.json
Saved favorites to 'm:\VS Code\proj\vs-remote-debugger\sdk\php\favs\myfavs.json'
save e:\test\myfavs.json
Saved favorites to 'e:\test\myfavs.json'
```

The first execution uses as relative path by using the value from *localSourceRoot* property (*configurations*) section of your *launch.json* file:

```json
{
    "version": "0.24.0",
    "configurations": [
        {
            // ...
            
            "localSourceRoot": "${workspaceRoot}",
            
            // ...
        }
    ]
}
```

###### Load from file

`load` loads the messages from the last created JSON file and appends them to your current list:

```
load
Loaded 1 entries from 'm:\VS Code\proj\vs-remote-debugger\sdk\php\vsrd_favs_1477841896882.json'
```

According to `save`, the command also supports an optional `$FILE` argument:

```
load favs/myfavs.json
Loaded 1 entries from 'm:\VS Code\proj\vs-remote-debugger\sdk\php\favs\myfavs.json'
load e:\test\myfavs.json
Loaded 1 entries from 'e:\test\myfavs.json'
```

##### Share

You also can share your favorites with other clients and constributors that have a running instance of the debugger.

The following example sends your favorites to `192.168.0.234:5979` (target MUST NOT be in 'pause' mode, otherwise the entries will be dropped there!):

```
send 192.168.0.234 5979

Send favorites to '192.168.0.234:5979'
```

Another way to do this, is to define a list of friends in your *launch.json* (*friends* property of *configurations* section):

```json
{
    "version": "0.24.0",
    "configurations": [
        {
            // ...
            
            "friends": [
                "192.168.0.102:1781=yvonne",
                "192.168.0.100:23979=marcel",
                "192.168.0.101:5979=tanja"
            ],
            
            // ...
        }
    ]
}
```

Each entry has the following format:

```
{REMOTE-ADDRESS}:{PORT}[={NAME}]
```

*{NAME}* is optional, but it is recommed to define that value explicitly.

Now you can use `share` command, if you want to send your favorites to *yvonne* and *tanja*, e.g.:

```
share yvonne tanja
Send favorites to 'yvonne' (192.168.0.102:1781)
Send favorites to 'tanja' (192.168.0.101:5979)
```

`friends` displays the list of your friends: 

```
[1] yvonne => 192.168.0.102:1781
[2] marcel => 192.168.0.100:23979
[3] tanja => 192.168.0.101:5979
```

##### Shortcuts

| Input | Description |
| ---- | --------- |
| `all` | Marks all messages as favorites. |
| `none` | Clears the list of favorites. |
| `trim` | Removes all entries that are NOT marked as favorites. |

#### Other commands

##### clear

Removes all loaded messages and favorites.

```
clear
Cleared
```

##### debug

Switches the debugger itself to *debug mode*.

```
debug
Debug mode
```

##### me

Lists all network interfaces of your machine.

```
me
[1] (IPv4) 192.168.0.100 / 255.255.255.0 (01:02:03:04:05:06)
```

Format of an entry: `(ADRESS-FAMILY) (ADDRESS) / (NET-MASK) (MAC-ADDRESS)`

##### nodebug

Switches the debugger itself to *NON debug mode*.

```
nodebug
Debug mode leaved
```

##### refresh

Refreshes the view of the current selected message.

```
refresh
New index: 1
```

##### wait

Starts waiting for a new message.

```
wait
New index: 1
```
