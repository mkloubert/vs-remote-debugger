<?php

define('MJK_REMOTE_DBG_TEST', 1);

require './config.inc.php';

function test_function(\MJK\Diagnostics\RemoteDebugger $debugger) {
    $debugger->dbg([
        'a' => date('Y-m-d H:i:s'),
        'b' => 1,
        'c' => 2.34,
        'd' => 'Marcel K! Marcel K! Marcel K!',
        'e' => false,
        'f' => null,
        'g' => true,
    ]);
}

class MyClass {
    public static function staticTestMethod(\MJK\Diagnostics\RemoteDebugger $debugger) {
        test_function($debugger);
    }
}

require './test1.inc.php';
