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

    $debugger->dbgIf(true, [
        'A' => date('Y-m-d H:i:s'),
        'B' => 1,
        'C' => 2.34,
        'D' => 'Marcel K! Marcel K! Marcel K!',
        'E' => false,
        'F' => null,
        'G' => true,
    ]);

    $debugger->dbgIf(function($evetData) { return false; }, [
        'AA' => date('Y-m-d H:i:s'),
        'BB' => 1,
        'CC' => 2.34,
        'DD' => 'Marcel K! Marcel K! Marcel K!',
        'EE' => false,
        'FF' => null,
        'GG' => true,
    ]);
}

class MyClass {
    public static function staticTestMethod(\MJK\Diagnostics\RemoteDebugger $debugger) {
        test_function($debugger);
    }
}

require './test1.inc.php';
