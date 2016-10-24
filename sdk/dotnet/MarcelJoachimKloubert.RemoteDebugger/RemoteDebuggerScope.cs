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
    /// A scope.
    /// </summary>
    [DataContract]
    public class RemoteDebuggerScope
    {
        /// <summary>
        /// The name.
        /// </summary>
        [DataMember]
        public string n;

        /// <summary>
        /// The reference number.
        /// </summary>
        [DataMember]
        public int? r;

        /// <summary>
        /// The list of debugger variables.
        /// </summary>
        [DataMember]
        public IList<RemoteDebuggerVariable> v;
    }
}
