//
// vs-remote-debugger (.NET SDK) (https://github.com/mkloubert/vs-remote-debugger)
// Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Newtonsoft.Json;
using System.Threading;
using System.Diagnostics;
using System.IO;
using System.Reflection;

namespace MarcelJoachimKloubert
{
    /// <summary>
    /// Describes a method or function that provides the endpoint of a target host.
    /// </summary>
    /// <returns>The endpoint of the target host.</returns>
    public delegate IPEndPoint RemoteDebuggerHostProvider();

    /// <summary>
    /// A remote debugger.
    /// </summary>
    public class RemoteDebugger : MarshalByRefObject
    {
        /// <summary>
        /// The default host.
        /// </summary>
        public const string DEFAULT_HOST = "localhost";
        /// <summary>
        /// The default TCP port.
        /// </summary>
        public const int DEFAULT_PORT = 5979;

        /// <summary>
        /// Stores the function that provides the target hosts.
        /// </summary>
        protected readonly ICollection<RemoteDebuggerHostProvider> _PROVIDERS = new List<RemoteDebuggerHostProvider>();
        
        /// <summary>
        /// Stores the object for thread safe operations.
        /// </summary>
        protected readonly object _SYNC = new object();

        /// <summary>
        /// Initializes a new instance of the <see cref="RemoteDebugger" /> class.
        /// </summary>
        public RemoteDebugger()
            : this(sync: null)
        {

        }

        /// <summary>
        /// Initializes a new instance of the <see cref="RemoteDebugger" /> class.
        /// </summary>
        /// <param name="sync">The custom value for the <see cref="RemoteDebugger._SYNC" /> field.</param>
        public RemoteDebugger(object sync)
        {
            _SYNC = sync ?? new object();
        }

        /// <summary>
        /// Adds a host.
        /// </summary>
        /// <param name="host">The target address.</param>
        public void AddHost(string host = null)
        {
            host = host?.ToLower().Trim();
            if (string.IsNullOrWhiteSpace(host))
            {
                host = "";
            }

            string hostNameOrAddress;
            int? port = null;
            var separator = host.IndexOf(":");
            if (separator > -1)
            {
                hostNameOrAddress = host.Substring(0, separator).Trim();

                var strPort = host.Substring(separator + 1).Trim();
                if ("" != strPort)
                {
                    port = int.Parse(strPort);
                }
            }
            else
            {
                hostNameOrAddress = host;
            }

            if ("" == hostNameOrAddress)
            {
                hostNameOrAddress = DEFAULT_HOST;
            }

            port = port ?? DEFAULT_PORT;
            AddHost(() =>
            {
                var ip = Dns.GetHostAddresses(hostNameOrAddress)
                            .OrderBy(x => x.AddressFamily)  // first order by IPv6 than by IPv4
                            .First(x => (Socket.OSSupportsIPv4 && x.AddressFamily == AddressFamily.InterNetwork) ||
                                        (Socket.OSSupportsIPv6 && x.AddressFamily == AddressFamily.InterNetworkV6));

                return new IPEndPoint(ip, port.Value);
            });
        }

        /// <summary>
        /// Adds a host.
        /// </summary>
        /// <param name="ip">The target IP address.</param>
        /// <param name="port">The custom port.</param>
        /// <exception cref="ArgumentNullException">
        /// <paramref name="ip" /> is <see langword="null" />.
        /// </exception>
        /// <exception cref="ArgumentOutOfRangeException">
        /// <paramref name="port" /> is invalid.
        /// </exception>
        public void AddHost(IPAddress ip, int? port = null)
        {
            if (ip == null)
            {
                throw new ArgumentNullException(nameof(ip));
            }

            if (port < IPEndPoint.MinPort || port > IPEndPoint.MaxPort)
            {
                throw new ArgumentOutOfRangeException(nameof(port));
            }

            AddHost(new IPEndPoint(ip, port ?? DEFAULT_PORT));
        }

        /// <summary>
        /// Adds a host.
        /// </summary>
        /// <param name="ep">The target endpoint.</param>
        /// <exception cref="ArgumentNullException">
        /// <paramref name="ep" /> is <see langword="null" />.
        /// </exception>
        public void AddHost(IPEndPoint ep)
        {
            if (ep == null)
            {
                throw new ArgumentNullException(nameof(ep));
            }

            AddHost(() => ep);
        }

        /// <summary>
        /// Adds a function / method that provides a host address.
        /// </summary>
        /// <param name="provider">The provider.</param>
        /// <exception cref="ArgumentNullException">
        /// <paramref name="provider" /> is <see langword="null" />.
        /// </exception>
        public void AddHost(RemoteDebuggerHostProvider provider)
        {
            if (provider == null)
            {
                throw new ArgumentNullException(nameof(provider));
            }

            _PROVIDERS.Add(provider);
        }

        /// <summary>
        /// Sends a debugger message.
        /// </summary>
        /// <param name="vars">The variables to send.</param>
        /// <param name="skipFrames">The number of frames to skip.</param>
        public void Dbg(IEnumerable<KeyValuePair<string, object>> vars = null, int skipFrames = 0)
        {
            DbgIf(true, vars, skipFrames + 2);
        }

        /// <summary>
        /// Sends a debugger message if a condition matches.
        /// </summary>
        /// <param name="condition">The condition value.</param>
        /// <param name="vars">The variables to send.</param>
        /// <param name="skipFrames">The number of frames to skip.</param>
        public void DbgIf(bool condition,
                          IEnumerable<KeyValuePair<string, object>> vars = null, int skipFrames = 0)
        {
            DbgIf(() => true,
                  vars, skipFrames + 1);
        }

        /// <summary>
        /// Sends a debugger message if a condition matches.
        /// </summary>
        /// <param name="predicate">The custom predicate that provides the condition value.</param>
        /// <param name="vars">The variables to send.</param>
        /// <param name="skipFrames">The number of frames to skip.</param>
        public void DbgIf(Func<bool> predicate = null,
                    IEnumerable<KeyValuePair<string, object>> vars = null, int skipFrames = 0)
        {
            if (predicate == null)
            {
                predicate = () => true;
            }

            try
            {
                var asm = Assembly.GetExecutingAssembly();

                IEnumerable<RemoteDebuggerHostProvider> providers;
                lock (_SYNC)
                {
                    providers = _PROVIDERS.ToArray();
                }

                using (var e = providers.GetEnumerator())
                {
                    while (e.MoveNext())
                    {
                        try
                        {
                            var p = e.Current;

                            var ep = p();
                            if (ep == null)
                            {
                                continue;
                            }

                            var entry = new RemoteDebuggerEntry()
                            {
                                s = new List<RemoteDebuggerStackFrame>(),
                                t = new List<RemoteDebuggerThread>(),
                            };
                            
                            if (vars != null)
                            {
                                entry.v = new List<RemoteDebuggerVariable>();

                                using (var e2 = vars.GetEnumerator())
                                {
                                    while (e2.MoveNext())
                                    {
                                        var v = e2.Current;

                                        entry.v.Add(ToVariableEntry(v.Key, v.Value));
                                    }
                                }
                            }

                            // threads
                            try
                            {
                                var currentThread = Thread.CurrentThread;

                                var thread = new RemoteDebuggerThread()
                                {
                                    i = currentThread.ManagedThreadId,
                                    n = currentThread.Name,
                                };
                                entry.t.Add(thread);

                                // stack traces
                                try
                                {
                                    var stackTrace = new StackTrace(true);

                                    var i = -1;
                                    var frames = stackTrace.GetFrames().Skip(skipFrames);
                                    var nextScopeRef = 0;
                                    using (var e2 = frames.GetEnumerator())
                                    {
                                        while (e2.MoveNext())
                                        {
                                            ++i;
                                            var f = e2.Current;

                                            var sf = new RemoteDebuggerStackFrame();
                                            sf.f = f.GetFileName();
                                            if (!string.IsNullOrWhiteSpace(sf.f))
                                            {
                                                sf.f = ToRelativePath(sf.f);
                                            }
                                            else
                                            {
                                                sf.f = null;
                                            }
                                            sf.fn = !string.IsNullOrWhiteSpace(sf.f) ? Path.GetFileName(sf.f) : null;
                                            sf.i = i;
            
                                            sf.l = f.GetFileLineNumber();
                                            if (sf.l < 1)
                                            {
                                                sf.l = null;
                                            }

                                            //TODO: sf.n

                                            ++nextScopeRef;
                                            sf.s = new List<RemoteDebuggerScope>();
                                            {
                                                var curFuncScrope = new RemoteDebuggerScope();
                                                curFuncScrope.n = "Current function";
                                                curFuncScrope.r = nextScopeRef * 2;
                                                curFuncScrope.v = new List<RemoteDebuggerVariable>();
                                                sf.s.Add(curFuncScrope);

                                                var dbgScope = new RemoteDebuggerScope();
                                                dbgScope.n = "Debugger";
                                                dbgScope.r = nextScopeRef * 2 + 1;
                                                dbgScope.v = new List<RemoteDebuggerVariable>();
                                                sf.s.Add(dbgScope);
                                            }

                                            sf.v = new List<RemoteDebuggerVariable>();

                                            entry.s.Add(sf);
                                        }
                                    }
                                }
                                catch { };
                            }
                            catch { };
                            
                            var json = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(entry));

                            var dataLength = BitConverter.GetBytes((uint)json.Length);
                            if (!BitConverter.IsLittleEndian)
                            {
                                // big endian
                                dataLength = dataLength.Reverse().ToArray();
                            }

                            // send data
                            using (var client = new TcpClient())
                            {
                                client.Connect(ep);

                                using (var ns = client.GetStream())
                                {
                                    ns.Write(dataLength, 0, dataLength.Length);
                                    ns.Write(json, 0, json.Length);

                                    ns.Flush();
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            if (ex != null)
                            {

                            }
                        }
                    }
                }
            }
            catch { }
        }

        /// <summary>
        /// Gets the object for thread safe operations.
        /// </summary>
        public object SyncRoot => _SYNC;

        /// <summary>
        /// Converts a path to a relative path.
        /// </summary>
        /// <param name="path">The input value.</param>
        /// <returns>The converted value.</returns>
        protected virtual string ToRelativePath(string path)
        {
            try
            {
                path = Path.GetFullPath(path);

                // var scopeDir = Path.GetFullPath(Environment.CurrentDirectory);
                var scopeDir = Path.GetDirectoryName(path);
                if (path.IndexOf(scopeDir) == 0)
                {
                    path = path.Substring(scopeDir.Length)
                               .Replace(Path.DirectorySeparatorChar, '/');
                }
            }
            catch { }

            return path;
        }

        /// <summary>
        /// Converts a key / value pair to a variable entry.
        /// </summary>
        /// <param name="name">The key / name.</param>
        /// <param name="value">The value.</param>
        /// <returns>The entry.</returns>
        protected virtual RemoteDebuggerVariable ToVariableEntry(string name, object value)
        {
            if (DBNull.Value.Equals(value))
            {
                value = null;
            }

            var type = "string";

            if (value != null && type == "string")
            {
                value = value.ToString();
            }

            return new RemoteDebuggerVariable()
            {
                t = type,
                n = name,
                v = value,
            };
        }
    }
}
