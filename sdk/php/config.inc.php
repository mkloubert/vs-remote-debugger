<?php

defined('MJK_REMOTE_DBG_TEST') or die();

spl_autoload_register(function($clsName) {
    $file = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'classes' . DIRECTORY_SEPARATOR .
                     str_replace('\\', DIRECTORY_SEPARATOR, $clsName) .
                     '.php');

    if (false !== $file) {
        require_once $file;
    }
});
