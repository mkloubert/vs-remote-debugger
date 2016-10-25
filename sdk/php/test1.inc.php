<?php

defined('MJK_REMOTE_DBG_TEST') or die();

$debugger = new \MJK\Diagnostics\RemoteDebugger();
$debugger->ScriptRoot = __DIR__;
$debugger->addHost("localhost", 23979);

$debugger->ErrorHandler = function($type, $err, $eventData) {
    echo 'ERROR: ' . var_export($err, true);
};

MyClass::staticTestMethod($debugger);
