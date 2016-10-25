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

using System.Runtime.Serialization;

namespace MarcelJoachimKloubert
{
    /// <summary>
    /// A variable.
    /// </summary>
    [DataContract]
    public class RemoteDebuggerVariable
    {
        /// <summary>
        /// If type is 'function' this is the function name.
        /// </summary>
        [DataMember]
        public string fn;

        /// <summary>
        /// The name.
        /// </summary>
        [DataMember]
        public string n;

        /// <summary>
        /// If type is 'object' this is the object name.
        /// </summary>
        [DataMember]
        public string on;

        /// <summary>
        /// The reference.
        /// </summary>
        [DataMember]
        public int? r;

        /// <summary>
        /// The data type.
        /// </summary>
        [DataMember]
        public string t;

        /// <summary>
        /// The value.
        /// </summary>
        [DataMember]
        public object v;
    }
}
