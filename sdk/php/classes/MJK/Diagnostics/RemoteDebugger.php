<?php

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
     */
    public function dbg($vars = []) {
        $backtrace = \debug_backtrace();

        $callingLine = $backtrace[0];

        $filter = $this->EntryFilter;

        foreach ($this->_hostProviders as $providerIndex => $provider) {
            try {
                $connData = $provider($this);
                if (empty($connData)) {
                    continue;
                }

                $eventData = [
                    'backtrace' => $backtrace,
                    'calling_line' => $callingLine,
                    'debugger' => $this,
                    'host' => $connData,
                    'provider' => [ $providerIndex, $provider ],
                ];

                $variableItems = null;
                if (!empty($vars)) {
                    // collect variables

                    $variableItems = [];
                    foreach ($vars as $vn => $vv) {
                        $variableItems[] = $this->toVariableEntry($vn, $vv);
                    }
                }

                $entry = [
                    't' => [],
                    's' => [],
                    'v' => $variableItems,
                ];

                $client = $this->unwrapValue($this->TargetClient);
                if (!empty($client)) {
                    $entry['c'] = $client;
                }

                $currentThread = $this->unwrapValue($this->CurrentThread, $eventData);
                if (!empty($currentThread)) {
                    $entry['t'][] = [
                        'i' => $currentThread[0],
                        'n' => $currentThread[1],
                    ];
                }

                $nextScopeRef = 0;
                foreach ($backtrace as $i => $bt) {
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
                        $stackFrame['f'] = $bt['file'];
                        $stackFrame['fn'] = \basename($stackFrame['f']);
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
                    ++$nextScopeRef;
                    $stackFrame['s'] = [
                        // current function
                        [
                            'n' => $sfCurrentFunc,
                            'r' => $nextScopeRef * 2,
                        ],

                        // debugger
                        [
                            'n' => $sfDebugger,
                            'r' => $nextScopeRef * 2 + 1,
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
                                        $argName = $parameters[$vn]->getName();
                                    }
                                }
                                else {
                                    $argName = 'arg' . $vn;
                                }
                            }

                            $stackFrame['s'][0]['v'][] = $this->toVariableEntry($argName,
                                                                                $vv);
                        }
                    }

                    if (!empty($stackFrame)) {
                        $entry['s'][] = $stackFrame;
                    }
                }

                if (!empty($callingLine['file'])) {
                    $entry['f'] = $callingLine['file'];
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
                if (false !== $json) {
                    $fp = @\fsockopen($connData[0], $connData[1], $errno, $errstr, $connData[2]);
                    if (\is_resource($fp)) {
                        try {
                            \fwrite($fp, \pack('V', \strlen($json)));
                            \fwrite($fp, $json);
                        }
                        finally {
                            \fclose($fp);
                        }
                    }
                    else {
                        //TODO: log
                    }
                }
                else {
                    //TODO: log
                }
            }
            catch (\Exception $ex) {

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
     * Makes a value serializable for the remote debugger.
     *
     * @param mixed $value The input value.
     * @param mixed &$type The value type.
     * @param int $step The current step (only for internal use).
     * @param int $maxSteps Maximum steps (only for internal use).
     *
     * @return string The output value.
     */
    protected function makeSerializable($value, &$type = null, $step = null, $maxSteps = 32) {
        if (\func_num_args() < 3) {
            $depth = 0;
        }
        else {
            if ($step >= $maxSteps) {
                // prevent stack overflows

                $type = 'string';
                return '###TOO DEEP###';
            }
        }

        if (null !== $value) {
            switch (\gettype($value)) {
                case 'array':
                    $arr = $value;
                    $value = [
                        'type' => 'array',
                        'value' => @\json_encode($arr),
                    ];
                    break;

                case 'boolean':
                    $type = 'string';
                    $value = $value ? 'true' : 'false';
                    break;

                case 'integer':
                    $type = 'integer';
                    $value = (string)$value;
                    break;

                case 'double':
                    $type = 'float';
                    $value = (string)$value;
                    break;

                case 'object':
                    $objInstance = $value;
                    $obj = new \ReflectionObject($objInstance);

                    $value = [
                        'type' => 'object',
                        'name' => $obj->getName(),
                    ];

                    $properties = $obj->getProperties();
                    if (!empty($properties)) {
                        $value['fields'] = [];
                        foreach ($properties as $p) {
                            $p->setAccessible(true);

                            $value['fields'][$p->getName()] = $this->makeSerializable($p->getValue($objInstance),
                                                                                      $type2,
                                                                                      $step + 1);
                        }
                    }
                    break;

                case 'string':
                    $value = (string)$value;
                    break;

                default:
                    $value = @\serialize($value);
                    break;
            }
        }

        if (\is_array($value)) {
            $type = 'object';

            $newValue = [];
            foreach ($value as $k => $v) {
                $newValue[$this->makeSerializable($k, $type2, $step + 1)] =
                    $this->makeSerializable($v, $type2, $step + 1);
            }

            $value = @\json_encode($newValue);
            unset($newValue);

            if (false !== $value) {
                $value = @\json_decode($value, true);
            }
        }

        return $value;
    }

    /**
     * Creates a variable entry.
     *
     * @param string $name The name of the variable.
     * @param mixed $value The value.
     *
     * @return array The created entry.
     */
    protected function toVariableEntry($name, $value) {
        $type = 'string';
        $value = $this->makeSerializable($value, $type);

        if (null !== $value && 'string' === $type) {
            $value = (string)$value;
        }

        return [
            'n' => '$' . $name,
            'r' => 0,
            't' => $type,
            'v' => $value,
        ];
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
