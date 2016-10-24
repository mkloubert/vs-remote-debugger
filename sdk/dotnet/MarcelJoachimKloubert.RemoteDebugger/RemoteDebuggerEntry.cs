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

using System.Collections.Generic;
using System.Runtime.Serialization;

namespace MarcelJoachimKloubert
{
    /// <summary>
    /// Describes a debugger entry.
    /// </summary>
    [DataContract]
    public class RemoteDebuggerEntry
    {
        /// <summary>
        /// The name of the app the entry is for.
        /// </summary>
        [DataMember]
        public string a;

        /// <summary>
        /// The name of the client the entry is for.
        /// </summary>
        [DataMember]
        public string c;

        /// <summary>
        /// The name of the file.
        /// </summary>
        [DataMember]
        public string f;

        /// <summary>
        /// The stacktrace.
        /// </summary>
        [DataMember]
        public IList<RemoteDebuggerStackFrame> s;

        /// <summary>
        /// The list of threads.
        /// </summary>
        [DataMember]
        public IList<RemoteDebuggerThread> t;

        /// <summary>
        /// The list of variables.
        /// </summary>
        [DataMember]
        public IList<RemoteDebuggerVariable> v;
    }
}
