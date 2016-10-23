<?php

defined('MJK_REMOTE_DBG_TEST') or die();

$debugger = new \MJK\Diagnostics\RemoteDebugger();
$debugger->TargetClient = 'Wurst';
$debugger->addHost(null, 23979);

MyClass::staticTestMethod($debugger);
