<?php

define('MJK_REMOTE_DBG_TEST', 1);

require './config.inc.php';

function test_function(\MJK\Diagnostics\RemoteDebugger $debugger) {
    $debugger->dbg([
        'a' => 1,
        'b' => 2.34,
        'c' => 'Marcel K! Marcel K! Marcel K!',
        'd' => false,
        'e' => null,
        'f' => true,
    ]);
}

class MyClass {
    public static function staticTestMethod(\MJK\Diagnostics\RemoteDebugger $debugger) {
        test_function($debugger);
    }
}

$debugger = new \MJK\Diagnostics\RemoteDebugger();
$debugger->addHost();

MyClass::staticTestMethod($debugger);
