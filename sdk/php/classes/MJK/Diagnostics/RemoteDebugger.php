<?php

/**
 * vs-remote-debugger (PHP SDK) (https://github.com/mkloubert/vs-remote-debugger)
 * Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace MJK\Diagnostics;

/**
 * A remote debugger.
 *
 * @package MJK\Diagnostics
 *
 * @author Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
 */
class RemoteDebugger {
    /**
     * Stores the list of provides that return the host address
     * and port of the remote debugger host.
     *
     * @var callable[]
     */
    protected $_hostProviders = [];

    /**
     * The name of the app or the callable that provides it.
     *
     * @var callable|string
     */
    public $App;
    /**
     * The name for the current function stack frame or the callable that provides it.
     *
     * @var callable|string
     */
    public $CurrentFunctionStackFrame;
    /**
     * The name for a current function variable or the callable that provides it.
     *
     * @var callable|string
     */
    public $CurrentFunctionVariable;
    /**
     * The data of the current thread or the callable that provides it.
     *
     * @var array callable
     */
    public $CurrentThread = [ 1, 'Thread #1' ];
    /**
     * The name for the Debugger stack frame or the callable that provides it.
     *
     * @var callable|string
     */
    public $DebuggerStackFrame;
    /**
     * Stores the default host address of the remote debugger host.
     *
     * @var string
     */
    public static $DefaultHost = '127.0.0.1';
    /**
     * Default value for the maximum depth of a variable tree.
     */
    public static $DefaultMaxDepth = 32;
    /**
     * Stores the TCP port of the remote debugger host.
     *
     * @var int
     */
    public static $DefaultPort = 5979;
    /**
     * Stores the default connection timeout.
     *
     * @var int
     */
    public static $DefaultTimeout = 5;
    /**
     * A callable that filters an entry BEFORE it is send.
     *
     * @var callable
     */
    public $EntryFilter;
    /**
     * A callable that is occurred if an exception is raised.
     *
     * @var callable
     */
    public $ErrorHandler;
    /**
     * A callable that "transforms" a JSON string into other data.
     *
     * @var callable
     */
    public $JsonTransformer;
    /**
     * A value that defines how deep a tree of
     * variables can be to prevent stack overflows.
     * 
     * @var int|callable
     */
    public $MaxDepth;
    /**
     * The path of the script root or the callable that provides it.
     *
     * @var callable|string
     */
    public $ScriptRoot;
    /**
     * The name of the target client or the callable that provides it.
     *
     * @var callable|string
     */
    public $TargetClient;

    /**
     * Adds a debugger host or a callable that provides its connection data.
     *
     * @param string|callable $addressOrProvider The host address of the remote
     *                                           host or the callable that provides its
     *                                           connection data.
     * @param int $port The custom TCP port.
     */
    public function addHost($addressOrProvider = null, $port = null, $timeout = null) {
        $dbgClass = new \ReflectionObject($this);

        $normalizeAddress = function($addr = null) use ($dbgClass) {
            $addr = \trim($addr);
            if (empty($addr)) {
                // use default
                $addr = $dbgClass->getProperty('DefaultHost')
                                 ->getValue(null);
            }

            return @\gethostbyname($addr);
        };

        $normalizePort = function($port = null) use ($dbgClass) {
            $port = \trim($port);
            if (empty($port)) {
                $port = $dbgClass->getProperty('DefaultPort')->getValue(null);
            }

            return (int)$port;
        };

        $normalizeTimeout = function($timeout = null) use ($dbgClass) {
            $timeout = \trim($timeout);
            if (empty($timeout)) {
                $timeout = $dbgClass->getProperty('DefaultTimeout')->getValue(null);
            }

            return (int)$timeout;
        };

        if (\func_num_args() < 1) {
            // defaults
            $addr = $normalizeAddress();
            $port = $normalizePort();
            $timeout = $normalizeTimeout();

            $provider = function() use ($addr, $port, $timeout) {
                return [ $addr, $port, $timeout ];
            };
        }
        else if (\func_num_args() < 2) {
            $provider = $addressOrProvider;
            if (!\is_callable($provider)) {
                $addr = $normalizeAddress($addressOrProvider);

                // default port & timeout
                $port = $normalizePort();
                $timeout = $normalizeTimeout();

                $provider = function() use ($addr, $port, $timeout) {
                    return [ $addr, $port, $timeout ];
                };
            }
        }
        else if (\func_num_args() < 3) {
            $provider = $addressOrProvider;
            if (!\is_callable($provider)) {
                $addr = $normalizeAddress($addressOrProvider);
                $port = $normalizePort($port);

                // default timeout
                $timeout = $normalizeTimeout();

                $provider = function() use ($addr, $port, $timeout) {
                    return [ $addr, $port, $timeout ];
                };
            }
        }
        else {
            $addr = $normalizeAddress($addressOrProvider);
            $port = $normalizePort($port);
            $timeout = $normalizeTimeout($timeout);

            $provider = function() use ($addr, $port, $timeout) {
                return [ $addr, $port, $timeout ];
            };
        }

        $this->_hostProviders[] = $provider;
    }

    /**
     * Sends a debugger message.
     *
     * @param array $vars The custom variables to send.
     * @param int $skipFrames The number of stack frames to skip.
     */
    public function dbg($vars = [], $skipFrames = 0) {
        $this->dbgIf(true,
                     $vars,
                     $skipFrames + 1);
    }

    /**
     * Sends a debugger message if a condition matches.
     *
     * @param bool|callable|null $condition The condition value or the callable that provides it.
     *                                      (null) is the same as (true).
     * @param array $vars The custom variables to send.
     * @param int $skipFrames The number of stack frames to skip.
     */
    public function dbgIf($condition, $vars = [], $skipFrames = 0) {
        $now = new \DateTime();
        $now->setTimezone(new \DateTimeZone('UTC'));

        if (!empty($vars)) {
            if (!\is_array($vars)) {
                $vars = \iterator_to_array($vars);
            }
        }

        $backtrace = \debug_backtrace();

        $callingLine = $backtrace[0 + $skipFrames];

        $filter = $this->EntryFilter;
        $transformer = $this->JsonTransformer;

        if (null === $condition) {
            $condition = true;
        }

        if (!\is_callable($condition)) {
            $conditionValue = $condition;
            $condition = function() use ($conditionValue) {
                return $conditionValue ? true : false;
            };
        }

        $errHandler = $this->ErrorHandler;
        $handleError = function($type, $err, $eventData) use ($errHandler) {
            if ($errHandler) {
                $errHandler($type, $err, $eventData);
            }
        };

        foreach ($this->_hostProviders as $providerIndex => $provider) {
            $connData = $provider($this);
            if (empty($connData)) {
                continue;
            }

            $eventData = [
                'backtrace' => $backtrace,
                'calling_line' => $callingLine,
                'debugger' => $this,
                'host' => $connData,
                'me' => $this,
                'provider' => [ $providerIndex, $provider ],
                'time' => $now,
            ];

            // max depth of a variable tree
            $maxSteps = \trim($this->unwrapValue($this->MaxDepth, $eventData));
            if (empty($maxSteps)) {
                $maxSteps = \trim($this->unwrapValue(static::$DefaultMaxDepth, $eventData));
            }
            if (empty($maxSteps)) {
                $maxSteps = 1;
            }
            $maxSteps = (int)$maxSteps;

            try {
                $nextVarRef = 1;

                $debuggerVars = null;
                if (!empty($vars)) {
                    // collect variables

                    $debuggerVars = [];
                    foreach ($vars as $vn => $vv) {
                        $debuggerVars[] = $this->toVariableEntry('$' . $vn, $vv,
                                                                 0, $nextVarRef,
                                                                 0, $maxSteps);
                    }
                }

                $eventData['vars'] = $debuggerVars;

                $eventData['condition'] = false !== $condition($eventData);
                if (!$eventData['condition']) {
                    // condition does NOT match
                    continue;
                }

                $entry = [
                    't' => [],
                    's' => [],
                    'v' => $debuggerVars,
                ];

                $client = $this->unwrapValue($this->TargetClient, $eventData);
                if (!empty($client)) {
                    $entry['c'] = $client;
                }

                $app = $this->unwrapValue($this->App, $eventData);
                if (!empty($app)) {
                    $entry['a'] = $app;
                }

                $currentThread = $this->unwrapValue($this->CurrentThread, $eventData);
                if (!empty($currentThread)) {
                    $entry['t'][] = [
                        'i' => $currentThread[0],
                        'n' => $currentThread[1],
                    ];
                }

                foreach ($backtrace as $i => $bt) {
                    if ($i < $skipFrames) {
                        continue;
                    }

                    if (empty($bt)) {
                        continue;
                    }

                    /**
                     * @var \ReflectionClass $obj
                     */
                    $obj = null;
                    if (!empty($bt['object'])) {
                        // object

                        if (\is_object($bt['object'])) {
                            $obj = new \ReflectionObject($bt['object']);
                        }
                    }
                    else if (!empty($bt['class'])) {
                        // class

                        if (\class_exists($bt['class'])) {
                            $obj = new \ReflectionClass($bt['class']);
                        }
                    }

                    /**
                     * @var \ReflectionFunctionAbstract $func
                     */
                    $func = null;
                    if (!empty($bt['function'])) {
                        if ($obj instanceof \ReflectionClass) {
                            // method

                            if ($obj->hasMethod($bt['function'])) {
                                $func = $obj->getMethod($bt['function']);
                            }
                        }
                        else {
                            // function

                            if (\function_exists($bt['function'])) {
                                $func = new \ReflectionFunction($bt['function']);
                            }
                        }
                    }

                    $stackFrame = [
                        'i' => $i,
                    ];

                    // file
                    if (!empty($bt['file'])) {
                        $stackFrame['ln'] = $bt['file'];
                        $stackFrame['f'] = $this->toRelativePath($stackFrame['ln']);
                        $stackFrame['fn'] = \basename($stackFrame['ln']);
                    }

                    // line
                    if (\array_key_exists('line', $bt)) {
                        $stackFrame['l'] = (int)\trim($bt['line']);
                    }

                    if (!empty($func)) {
                        $stackFrameName = null;
                        if ($func instanceof \ReflectionMethod) {
                            $stackFrameName  = $func->getDeclaringClass()->getName();
                            $stackFrameName .= $func->isStatic() ? '::' : '->';
                            $stackFrameName .= $func->getName();
                            $stackFrameName .= '()';
                        }
                        else {
                            $stackFrameName = $func->isClosure() ? '#CLOSURE' : $func->getName();
                            $stackFrameName .= '()';
                        }

                        $stackFrame['n'] = $stackFrameName;
                    }
                    else {
                        if (!empty($bt['function'])) {
                            $stackFrame['n'] = $bt['function'];
                        }
                    }

                    // get stack frame name for 'current function'
                    $sfCurrentFunc = $this->CurrentFunctionStackFrame;
                    if (!empty($sfCurrentFunc)) {
                        $sfCurrentFunc = $this->unwrapValue($sfCurrentFunc, $eventData);
                    }
                    if (empty($sfCurrentFunc)) {
                        $sfCurrentFunc = 'Current function';
                    }

                    // get stack frame name for Debugger
                    $sfDebugger = $this->DebuggerStackFrame;
                    if (!empty($sfDebugger)) {
                        $sfDebugger = $this->unwrapValue($sfDebugger, $eventData);
                    }
                    if (empty($sfDebugger)) {
                        $sfDebugger = 'Debugger';
                    }

                    // scopes of current frame
                    $stackFrame['s'] = [
                        // current function
                        [
                            'n' => $sfCurrentFunc,
                            'r' => ++$nextVarRef,
                        ],

                        // debugger
                        [
                            'n' => $sfDebugger,
                            'r' => 1,
                        ],
                    ];

                    // arguments of current function
                    if (!empty($bt['args'])) {
                        $stackFrame['s'][0]['v'] = [];

                        foreach ($bt['args'] as $vn => $vv) {
                            // get name of variable
                            $argName = $this->CurrentFunctionVariable;
                            while ($this->isCallable($argName)) {
                                $argName = $argName([
                                    'event' => $eventData,
                                    'name' => $argName,
                                    'original_name' => $vn,
                                    'stack_frame' => [
                                        'data' => $bt,
                                        'index' => $i,
                                    ],
                                    'value' => $vv,
                                ]);
                            }

                            if (null === $argName) {
                                if ($func instanceof \ReflectionFunctionAbstract) {
                                    $parameters = $func->getParameters();
                                    if (!empty($parameters[$vn])) {
                                        $argName = '$' . $parameters[$vn]->getName();
                                    }
                                }
                                else {
                                    $argName = '(arg' . $vn . ')';
                                }
                            }

                            $stackFrame['s'][0]['v'][] = $this->toVariableEntry($argName, $vv,
                                                                                0, $nextVarRef,
                                                                                0, $maxSteps);
                        }
                    }

                    if (!empty($stackFrame)) {
                        $entry['s'][] = $stackFrame;
                    }
                }

                if (null !== $filter) {
                    $entry = $this->unwrapValue($filter($entry),
                                                $eventData);
                }

                if (empty($entry)) {
                    // nothing to send
                    continue;
                }

                $json = @\json_encode($entry);
                if (null !== $transformer) {
                    $json = $transformer($json);
                }

                // echo @\json_encode($entry, JSON_PRETTY_PRINT);

                if (false !== $json) {
                    $fp = @\fsockopen($connData[0], $connData[1], $errno, $errstr, $connData[2]);
                    if (\is_resource($fp)) {
                        try {
                            if (false !== @\fwrite($fp, \pack('V', \strlen($json)))) {
                                if (false === @\fwrite($fp, $json)) {
                                    // could not send JSON
                                    $handleError('send.json',
                                                 @\error_get_last(),
                                                 $eventData);
                                }
                            }
                            else {
                                // could not send data length
                                $handleError('send.datalength',
                                             @\error_get_last(),
                                             $eventData);
                            }
                        }
                        finally {
                            @\fclose($fp);
                        }
                    }
                    else {
                        // connection error
                        $handleError('connection',
                                     [$errno, $errstr],
                                     $eventData);
                    }
                }
                else {
                    // JSON error
                    $handleError('json',
                                 [@\json_last_error(), @\json_last_error_msg()],
                                 $eventData);
                }
            }
            catch (\Exception $ex) {
                $handleError('exception', $ex, $eventData);
            }
        }
    }

    /**
     * Checks if a value is callable.
     *
     * @param mixed $val The value to check.
     *
     * @return bool Is callable or not.
     */
    protected function isCallable($val) {
        return !empty($val) &&
               (($val instanceof \Closure) || (\is_array($val) && \is_callable($val)));
    }

    /**
     * Tries to convert a full path to a relative path.
     * 
     * @param string $path The input value.
     * 
     * @return string The output value.
     */
    protected function toRelativePath($path) {
        $normalizedPath = \realpath($path);
        if (\file_exists($normalizedPath)) {
            $scriptRoot = $this->unwrapValue($this->ScriptRoot);
            if (empty($scriptRoot)) {
                // first try DOCUMENT_ROOT
                if (!empty($_SERVER['DOCUMENT_ROOT'])) {
                    $scriptRoot = \realpath($_SERVER['DOCUMENT_ROOT']);
                }

                if (!\is_dir($scriptRoot)) {
                    // now try getcwd() function
                    $scriptRoot = \realpath(@\getcwd());
                }
            }

            if (\is_dir($scriptRoot)) {
                if (0 === \stripos($normalizedPath, $scriptRoot)) {
                    $path = \substr($normalizedPath, \strlen($scriptRoot));
                    $path = \str_replace(\DIRECTORY_SEPARATOR, '/', $path);
                }
            }
        }

        return $path;
    }

    /**
     * Creates a variable entry.
     *
     * @param string $name The name of the variable.
     * @param mixed $value The value.
     *
     * @return array The created entry.
     */
    protected function toVariableEntry($name, $value,
                                       $ref = 0, &$nextVarRef = 0,
                                       $step = null, $maxSteps = 32) {
        if (\func_num_args() < 4) {
            $step = 0;
        }

        $entry = [];

        $type = 'string';

        if ($step < $maxSteps) {
            if (null !== $value) {
                switch (\gettype($value)) {
                    case 'boolean':
                        $value = $value ? 'true': 'false';
                        break;

                    case 'double':
                        $type = 'float';
                        $value = (string)$value;
                        break;

                    case 'integer':
                        $type = 'integer';
                        $value = (string)$value;
                        break;

                    case 'array':
                        $ref = (int)(string)++$nextVarRef;
                        
                        $obj = [];

                        $type = 'array';
                        foreach ($value as $k => $v) {
                            $obj[] = $this->toVariableEntry('[' . $k . ']', $v,
                                                            0, $nextVarRef,
                                                            $step + 1, $maxSteps);
                        }
                        $value = &$obj;
                        break;

                    case 'object':
                        if ($value instanceof \Traversable) {
                            // handle as array
                            return $this->toVariableEntry($name, \iterator_to_array($value),
                                                          $ref, $nextVarRef,
                                                          $step, $maxSteps);
                        }
                        else if ($value instanceof \Closure) {
                            $ref = (int)(string)++$nextVarRef;

                            $obj = [];
                            $type = 'function';
                            {
                                $func = new \ReflectionFunction($value);

                                $entry['fn'] = $func->getName();

                                // get parameters
                                foreach ($func->getParameters() as $fp) {
                                    $paramName = '$' . $fp->getName();
                                    if ($fp->isPassedByReference()) {
                                        $paramName = '&' . $paramName;
                                    }

                                    if ($fp->isOptional()) {
                                        $paramName = '[' . $paramName . ']';
                                    }

                                    $paramType = '(mixed)';
                                    if ($fp->isCallable()) {
                                        $paramType = '(callable)';
                                    }
                                    else if ($fp->isArray()) {
                                        $paramType = '(array)';
                                    }

                                    $obj[] = $this->toVariableEntry($paramName, $paramType,
                                                                    0, $nextVarRef,
                                                                    $step + 1, $maxSteps);
                                }
                            }
                            $value = &$obj;
                        }
                        else {
                            $ref = (int)(string)++$nextVarRef;

                            $obj = [];
                            $type = 'object';
                            {
                                $entry['on'] = @\get_class($value);

                                $ro = new \ReflectionObject($value);

                                // get properties
                                $objProps = $ro->getProperties();
                                \usort($objProps, function(\ReflectionProperty $x, \ReflectionProperty $y) {
                                    return \strcasecmp($x->getName(), $y->getName());
                                });
                                foreach ($objProps as $prop) {
                                    /* @var \ReflectionProperty $prop */

                                    $prop->setAccessible(true);
                                    if ($prop->isStatic()) {
                                        $propValueRef = null;
                                    }
                                    else {
                                        $propValueRef = $value;
                                    }

                                    $obj[] = $this->toVariableEntry('$' . $prop->getName(), $prop->getValue($propValueRef),
                                                                    0, $nextVarRef,
                                                                    $step + 1, $maxSteps);
                                }
                            }
                            $value = &$obj;
                        }
                        break;
                }
            }
        }
        else {
            // TOO deep

            $type = 'string';
            $value = '###TOO DEEP###';
        }

        if (null !== $value && 'string' === $type) {
            $value = (string)$value;
        }

        $entry['n'] = (string)$name;
        $entry['r'] = $ref;
        $entry['t'] = $type;
        $entry['v'] = $value;

        return $entry;
    }

    /**
     * Unwraps a value.
     *
     * @param mixed $val The value to unwrap.
     * @param array $args Additional arguments if a value is a callable.
     * @param int $step The current step (only for internal use).
     * @param int $maxSteps Maximum steps (only for internal use).
     *
     * @return mixed The unwrapped value.
     */
    protected function unwrapValue($val, $args = [], $step = null, $maxSteps = 32) {
        if (\func_num_args() < 3) {
            $step = 0;
        }
        else {
            if ($step >= $maxSteps) {
                return $val;  // prevent stack overflows
            }
        }

        while ($this->isCallable($val)) {
            $val = $this->unwrapValue($val($this, $args, $step),
                                      $args,
                                      $step + 1);
        }

        return $val;
    }
}
