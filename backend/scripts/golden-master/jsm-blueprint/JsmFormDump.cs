using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;
using System.Text;
using System.Text.RegularExpressions;

// Reflection-only reader of JSM's WinForms screens (VB.NET). Never executes JSM code.
// Walks InitializeComponent (design) and *_Load / *_Shown (runtime defaults) IL.
public static class JsmFormDump
{
    static Dictionary<short, OpCode> ops = new Dictionary<short, OpCode>();
    static string Dir;

    static void InitOps()
    {
        if (ops.Count > 0) return;
        foreach (var f in typeof(OpCodes).GetFields(BindingFlags.Public | BindingFlags.Static))
        {
            var op = (OpCode)f.GetValue(null);
            ops[op.Value] = op;
        }
    }

    static Assembly Resolve(object s, ResolveEventArgs e)
    {
        var name = new AssemblyName(e.Name).Name;
        var p = Path.Combine(Dir, name + ".dll");
        if (File.Exists(p)) return Assembly.ReflectionOnlyLoadFrom(p);
        try { return Assembly.ReflectionOnlyLoad(e.Name); } catch { return null; }
    }

    class Ctl
    {
        public string Name, Type, Text, Parent;
        public int X = -1, Y = -1, W = -1, H = -1, Tab = -1;
        public bool? Visible, Checked, Enabled;
        public List<string> Items = new List<string>();
        public string RtText;
        public bool? RtChecked, RtVisible, RtEnabled;
        public int RtSelectedIndex = -99;
        public List<string> RtItems = new List<string>();
    }

    class FormState
    {
        public Dictionary<string, Ctl> Ctls = new Dictionary<string, Ctl>();
        public string Text, RtText;
        public int W = -1, H = -1;
        public Ctl Get(string n) { Ctl c; if (!Ctls.TryGetValue(n, out c)) { c = new Ctl { Name = n }; Ctls[n] = c; } return c; }
    }

    static string Esc(string s)
    {
        if (s == null) return "null";
        var sb = new StringBuilder("\"");
        foreach (var c in s)
        {
            if (c == '"' || c == '\\') sb.Append('\\').Append(c);
            else if (c < 32) sb.AppendFormat("\\u{0:x4}", (int)c);
            else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }

    static string B(bool? b) { return b.HasValue ? (b.Value ? "true" : "false") : "null"; }

    static int OperandSize(OpCode op, byte[] il, int i)
    {
        switch (op.OperandType)
        {
            case OperandType.InlineNone: return 0;
            case OperandType.ShortInlineBrTarget: case OperandType.ShortInlineI: case OperandType.ShortInlineVar: return 1;
            case OperandType.InlineVar: return 2;
            case OperandType.InlineI8: case OperandType.InlineR: return 8;
            case OperandType.InlineSwitch: return 4 + 4 * BitConverter.ToInt32(il, i);
            default: return 4;
        }
    }

    static void Walk(Type t, Assembly asm, Module mod, byte[] il, FormState fs, bool runtime)
    {
        var ints = new List<int>();
        string lastStr = null;
        var strArray = new List<string>();
        string lastNewType = null;
        var stack = new List<string>();
        int i = 0;
        while (i < il.Length)
        {
            OpCode op; short code = il[i];
            if (code == 0xFE) { code = (short)(0xFE00 | il[i + 1]); if (!ops.TryGetValue(code, out op)) return; i += 2; }
            else { if (!ops.TryGetValue(code, out op)) return; i += 1; }
            int size = OperandSize(op, il, i);
            int token = size == 4 ? BitConverter.ToInt32(il, i) : 0;

            if (op == OpCodes.Ldarg_0) stack.Add("this");
            else if (op == OpCodes.Ldfld)
            {
                string fname = null;
                try { fname = mod.ResolveField(token).Name; } catch { }
                if (stack.Count > 0 && stack[stack.Count - 1] == "this") stack[stack.Count - 1] = fname; else stack.Add(fname);
            }
            else if (op == OpCodes.Ldstr) { try { lastStr = mod.ResolveString(token); } catch { lastStr = null; } strArray.Add(lastStr); }
            else if (op.Value >= OpCodes.Ldc_I4_M1.Value && op.Value <= OpCodes.Ldc_I4_8.Value) ints.Add(op.Value - OpCodes.Ldc_I4_0.Value);
            else if (op == OpCodes.Ldc_I4_S) ints.Add((sbyte)il[i]);
            else if (op == OpCodes.Ldc_I4) ints.Add(token);
            else if (op == OpCodes.Newobj) { try { lastNewType = mod.ResolveMethod(token).DeclaringType.Name; } catch { lastNewType = null; } }
            else if (op == OpCodes.Stfld)
            {
                if (!runtime) { try { var f = mod.ResolveField(token); if (lastNewType != null) fs.Get(f.Name).Type = lastNewType; } catch { } }
                stack.Clear(); ints.Clear(); strArray.Clear(); lastNewType = null;
            }
            else if (op == OpCodes.Call || op == OpCodes.Callvirt)
            {
                string mname = null; bool onForm = false;
                try
                {
                    var mb = mod.ResolveMethod(token);
                    mname = mb.Name;
                    onForm = mb.DeclaringType != null && mb.DeclaringType.Assembly == asm && (mb.DeclaringType == t || t.IsSubclassOf(mb.DeclaringType));
                }
                catch { }
                bool topIsThis = stack.Count > 0 && stack[stack.Count - 1] == "this";
                if (mname != null && mname.StartsWith("get_"))
                {
                    if (onForm && topIsThis) stack[stack.Count - 1] = mname.Substring(4);
                    i += size; continue;
                }
                if (!runtime && mname != null && mname.StartsWith("set_") && onForm && stack.Count == 1 && topIsThis && lastNewType != null)
                {
                    fs.Get(mname.Substring(4)).Type = lastNewType;
                    stack.Clear(); ints.Clear(); strArray.Clear(); lastNewType = null;
                    i += size; continue;
                }
                string tgt = stack.Count > 0 ? stack[0] : null;
                Ctl c = (tgt != null && tgt != "this" && fs.Ctls.ContainsKey(tgt)) ? fs.Ctls[tgt] : (!runtime && tgt != null && tgt != "this" ? fs.Get(tgt) : null);
                int lastInt = ints.Count > 0 ? ints[ints.Count - 1] : int.MinValue;
                if (mname == "set_Text")
                {
                    if (c != null) { if (runtime) c.RtText = lastStr; else c.Text = lastStr; }
                    else if (tgt == "this") { if (runtime) fs.RtText = lastStr; else fs.Text = lastStr; }
                }
                else if (!runtime && mname == "set_Location" && ints.Count >= 2 && c != null) { c.X = ints[ints.Count - 2]; c.Y = ints[ints.Count - 1]; }
                else if (!runtime && mname == "set_Size" && ints.Count >= 2 && c != null) { c.W = ints[ints.Count - 2]; c.H = ints[ints.Count - 1]; }
                else if (!runtime && mname == "set_ClientSize" && ints.Count >= 2 && tgt == "this") { fs.W = ints[ints.Count - 2]; fs.H = ints[ints.Count - 1]; }
                else if (!runtime && mname == "set_TabIndex" && c != null && lastInt != int.MinValue) c.Tab = lastInt;
                else if (mname == "set_Visible" && c != null && lastInt != int.MinValue) { if (runtime) c.RtVisible = lastInt != 0; else c.Visible = lastInt != 0; }
                else if (mname == "set_Checked" && c != null && lastInt != int.MinValue) { if (runtime) c.RtChecked = lastInt != 0; else c.Checked = lastInt != 0; }
                else if (mname == "set_Enabled" && c != null && lastInt != int.MinValue) { if (runtime) c.RtEnabled = lastInt != 0; else c.Enabled = lastInt != 0; }
                else if (mname == "set_SelectedIndex" && c != null && lastInt != int.MinValue && runtime) c.RtSelectedIndex = lastInt;
                else if (!runtime && mname == "set_HeaderText" && c != null) c.Text = lastStr;
                else if (mname == "AddRange" && c != null)
                {
                    if (!runtime && stack.Count > 1)
                    {
                        for (int k = 1; k < stack.Count; k++)
                        {
                            var ch = stack[k];
                            if (ch != null && ch != "this" && fs.Ctls.ContainsKey(ch) && fs.Ctls[ch].Parent == null) { fs.Ctls[ch].Parent = tgt; fs.Ctls[ch].Tab = k - 1; }
                        }
                    }
                    if (strArray.Count > 0) (runtime ? c.RtItems : c.Items).AddRange(strArray.Where(x => x != null));
                }
                else if (runtime && mname == "Clear" && c != null) { if (c.RtItems.Count > 0 && c.RtItems[c.RtItems.Count - 1] != "|") c.RtItems.Add("|"); }
                else if (mname == "Add" && c != null)
                {
                    var child = stack.Count >= 2 ? stack[stack.Count - 1] : null;
                    if (!runtime && child != null && child != tgt && fs.Ctls.ContainsKey(child)) fs.Ctls[child].Parent = tgt;
                    else if (strArray.Count > 0 && lastStr != null) (runtime ? c.RtItems : c.Items).Add(lastStr);
                }
                stack.Clear(); ints.Clear(); strArray.Clear();
            }
            else if (op == OpCodes.Pop || op == OpCodes.Ret) { stack.Clear(); ints.Clear(); strArray.Clear(); }
            i += size;
        }
    }

    static List<string> MethodStrings(MethodInfo m, Module mod)
    {
        var list = new List<string>();
        byte[] il;
        try { var body = m.GetMethodBody(); if (body == null) return list; il = body.GetILAsByteArray(); } catch { return list; }
        int i = 0;
        while (i < il.Length)
        {
            OpCode op; short code = il[i];
            if (code == 0xFE) { code = (short)(0xFE00 | il[i + 1]); if (!ops.TryGetValue(code, out op)) break; i += 2; }
            else { if (!ops.TryGetValue(code, out op)) break; i += 1; }
            int size = OperandSize(op, il, i);
            if (op == OpCodes.Ldstr) { try { list.Add(mod.ResolveString(BitConverter.ToInt32(il, i))); } catch { } }
            else if (op == OpCodes.Newobj)
            {
                try
                {
                    var ctor = mod.ResolveMethod(BitConverter.ToInt32(il, i));
                    if (ctor.DeclaringType != null && ctor.DeclaringType.Assembly == m.DeclaringType.Assembly) list.Add("new:" + ctor.DeclaringType.Name);
                }
                catch { }
            }
            i += size;
        }
        return list;
    }

    static byte[] Il(MethodInfo m) { try { var b = m.GetMethodBody(); return b == null ? null : b.GetILAsByteArray(); } catch { return null; } }

    public static string Disasm(string dir, string exe, string typeName, string methodName)
    {
        Dir = dir; InitOps();
        AppDomain.CurrentDomain.ReflectionOnlyAssemblyResolve += Resolve;
        var asm = Assembly.ReflectionOnlyLoadFrom(Path.Combine(dir, exe));
        var mod = asm.ManifestModule;
        var t = asm.GetType("Jsm_Winsoft." + typeName);
        var sb = new StringBuilder();
        foreach (var m in t.GetMethods(BindingFlags.Instance | BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.DeclaredOnly).Where(x => x.Name == methodName))
        {
            var il = Il(m); if (il == null) continue;
            int i = 0;
            while (i < il.Length)
            {
                int at = i; OpCode op; short code = il[i];
                if (code == 0xFE) { code = (short)(0xFE00 | il[i + 1]); op = ops[code]; i += 2; } else { op = ops[code]; i += 1; }
                int size = OperandSize(op, il, i);
                string arg = "";
                try
                {
                    if (size == 4 && op.OperandType != OperandType.InlineBrTarget && op.OperandType != OperandType.InlineI && op.OperandType != OperandType.ShortInlineR)
                    {
                        int tok = BitConverter.ToInt32(il, i);
                        if (op == OpCodes.Ldstr) arg = Esc(mod.ResolveString(tok));
                        else if (op.OperandType == OperandType.InlineMethod) { var mb = mod.ResolveMethod(tok); arg = mb.DeclaringType.Name + "::" + mb.Name; }
                        else if (op.OperandType == OperandType.InlineField) arg = mod.ResolveField(tok).Name;
                        else if (op.OperandType == OperandType.InlineType) arg = mod.ResolveType(tok).Name;
                    }
                    else if (op.OperandType == OperandType.InlineI) arg = BitConverter.ToInt32(il, i).ToString();
                    else if (op.OperandType == OperandType.ShortInlineI) arg = ((sbyte)il[i]).ToString();
                    else if (op.OperandType == OperandType.InlineBrTarget) arg = "-> " + (i + 4 + BitConverter.ToInt32(il, i));
                    else if (op.OperandType == OperandType.ShortInlineBrTarget) arg = "-> " + (i + 1 + (sbyte)il[i]);
                    else if (op.OperandType == OperandType.ShortInlineVar) arg = il[i].ToString();
                }
                catch { arg = "?"; }
                sb.AppendLine(at + ": " + op.Name + " " + arg);
                i += size;
            }
        }
        return sb.ToString();
    }

    public static string Run(string dir, string exe, string filter)
    {
        Dir = dir;
        InitOps();
        AppDomain.CurrentDomain.ReflectionOnlyAssemblyResolve += Resolve;
        var asm = Assembly.ReflectionOnlyLoadFrom(Path.Combine(dir, exe));
        Type[] types;
        try { types = asm.GetTypes(); } catch (ReflectionTypeLoadException ex) { types = ex.Types.Where(t => t != null).ToArray(); }
        var mod = asm.ManifestModule;
        var flags = BindingFlags.Instance | BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.DeclaredOnly;
        var outSb = new StringBuilder("[");
        bool firstForm = true;
        foreach (var t in types.OrderBy(x => x.FullName))
        {
            if (!string.IsNullOrEmpty(filter) && !Regex.IsMatch(t.Name, filter)) continue;
            MethodInfo init = null;
            try { init = t.GetMethod("InitializeComponent", flags); } catch { }
            if (init == null) continue;
            var il = Il(init);
            if (il == null) continue;

            var fs = new FormState();
            Walk(t, asm, mod, il, fs, false);
            MethodInfo[] methods;
            try { methods = t.GetMethods(flags); } catch { methods = new MethodInfo[0]; }
            foreach (var m in methods.Where(m => Regex.IsMatch(m.Name, "(_Load|_Shown|_Activated)$", RegexOptions.IgnoreCase)))
            {
                var mil = Il(m);
                if (mil != null) Walk(t, asm, mod, mil, fs, true);
            }

            if (!firstForm) outSb.Append(",\n");
            firstForm = false;
            outSb.Append("{\"form\":").Append(Esc(t.Name)).Append(",\"title\":").Append(Esc(fs.Text)).Append(",\"rtTitle\":").Append(Esc(fs.RtText))
                 .Append(",\"w\":").Append(fs.W).Append(",\"h\":").Append(fs.H).Append(",\"controls\":[");
            bool first = true;
            foreach (var c in fs.Ctls.Values.Where(c => c.Type != null))
            {
                if (!first) outSb.Append(",");
                first = false;
                outSb.Append("{\"name\":").Append(Esc(c.Name)).Append(",\"type\":").Append(Esc(c.Type))
                     .Append(",\"text\":").Append(Esc(c.Text)).Append(",\"parent\":").Append(Esc(c.Parent))
                     .Append(",\"x\":").Append(c.X).Append(",\"y\":").Append(c.Y).Append(",\"w\":").Append(c.W).Append(",\"h\":").Append(c.H)
                     .Append(",\"tab\":").Append(c.Tab)
                     .Append(",\"visible\":").Append(B(c.Visible)).Append(",\"checked\":").Append(B(c.Checked)).Append(",\"enabled\":").Append(B(c.Enabled))
                     .Append(",\"items\":[").Append(string.Join(",", c.Items.Select(Esc))).Append("]")
                     .Append(",\"rt\":{\"text\":").Append(Esc(c.RtText)).Append(",\"checked\":").Append(B(c.RtChecked))
                     .Append(",\"visible\":").Append(B(c.RtVisible)).Append(",\"enabled\":").Append(B(c.RtEnabled))
                     .Append(",\"selectedIndex\":").Append(c.RtSelectedIndex == -99 ? "null" : c.RtSelectedIndex.ToString())
                     .Append(",\"items\":[").Append(string.Join(",", c.RtItems.Select(Esc))).Append("]}}");
            }
            outSb.Append("],\"methods\":{");
            bool firstM = true;
            foreach (var m in methods)
            {
                if (m.Name == "InitializeComponent" || m.Name == "Dispose") continue;
                var strs = MethodStrings(m, mod).Where(x => x != null && x.Trim().Length > 0).Distinct().ToList();
                if (strs.Count == 0) continue;
                if (!firstM) outSb.Append(",");
                firstM = false;
                outSb.Append(Esc(m.Name)).Append(":[").Append(string.Join(",", strs.Select(Esc))).Append("]");
            }
            outSb.Append("}}");
        }
        outSb.Append("]");
        return outSb.ToString();
    }
}
