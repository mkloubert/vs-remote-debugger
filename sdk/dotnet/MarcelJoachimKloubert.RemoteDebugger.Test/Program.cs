using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MarcelJoachimKloubert.Test
{
    internal static class Program
    {
        private static void Main(string[] args)
        {
            try
            {
                var debugger = new global::MarcelJoachimKloubert.RemoteDebugger();
                debugger.AddHost("localhost:23979");

                debugger.Dbg(new Dictionary<string, object>()
                {
                    {  "a", 1 },
                });
            }
            catch (Exception ex)
            {
                if (ex != null)
                {

                }
            }

            Console.WriteLine();
            Console.WriteLine();
            Console.WriteLine("===== ENTER =====");
            Console.ReadLine();
        }
    }
}
