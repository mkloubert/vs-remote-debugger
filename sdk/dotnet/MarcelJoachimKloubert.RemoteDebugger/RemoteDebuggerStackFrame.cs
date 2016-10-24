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
    /// A frame of a stacktrace.
    /// </summary>
    [DataContract]
    public class RemoteDebuggerStackFrame
    {
        /// <summary>
        /// The file path.
        /// </summary>
        [DataMember]
        public string f;

        /// <summary>
        /// The file name.
        /// </summary>
        [DataMember]
        public string fn;

        /// <summary>
        /// The ID.
        /// </summary>
        [DataMember]
        public int? i;

        /// <summary>
        /// The line in the file.
        /// </summary>
        [DataMember]
        public int? l;

        /// <summary>
        /// The name.
        /// </summary>
        [DataMember]
        public string n;

        /// <summary>
        /// The list of scopes.
        /// </summary>
        [DataMember]
        public IList<RemoteDebuggerScope> s;

        /// <summary>
        /// The list of variables.
        /// </summary>
        [DataMember]
        public IList<RemoteDebuggerVariable> v;
    }
}
