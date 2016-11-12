<?php

define('MJK_REMOTE_DBG_TEST', 1);

require './config.inc.php';

function test_function(\MJK\Diagnostics\RemoteDebugger $debugger) {
    $obj = new \stdClass();
    $obj->i1 = 0.1;
    $obj->i2 = "123";
    
    $debugger->dbg([
        'a' => date('Y-m-d H:i:s'),
        'b' => 1,
        'c' => 2.34,
        'd' => 'Marcel K! Marcel K! Marcel K!',
        'e' => false,
        'f' => null,
        'g' => true,
        'h' => [
            'h1' => 0,
            'h2' => 1.2,
            'h3' => function(&$A, callable $B, array $C = []) {

            }
        ],
        'i' => $obj,
        'j' => [ 'MK', 'TM' ],
        'k' => function($a, callable $b, array &$c = []) {

        }
    ]);

    $debugger->dbgIf(true,
                     get_defined_vars());

    $debugger->dbgIf(function($eventData) { return false; }, [
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
