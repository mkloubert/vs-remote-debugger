<?php

defined('MJK_REMOTE_DBG_TEST') or die();

$debugger = new \MJK\Diagnostics\RemoteDebugger();

// activate the "gzip" plugin in your
// launch.json file in VS Code!
$debugger->JsonTransformer = function($json) {
    return @\gzencode($json);
};

$debugger->DumpBody = true;
$debugger->ScriptRoot = __DIR__;
$debugger->MaxDepth = 16;
$debugger->addHost("localhost", 23979);

$debugger->ErrorHandler = function($type, $err, $eventData) {
    echo 'ERROR: ' . var_export($err, true);
};

// uncomment this if you would like to run
// the VS Code instance in HTTP mode
//
// KEEP IN MIND: this mode is much slower!
//
// $debugger->setupForHttp();

MyClass::staticTestMethod($debugger);
