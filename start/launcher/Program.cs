using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace StartProjectLauncher
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            var projectDirectory = AppDomain.CurrentDomain.BaseDirectory;
            var startDirectory = Path.Combine(projectDirectory, "start");
            var batchPath = Path.Combine(startDirectory, "Start-Remote-D1-Website.bat");

            if (!File.Exists(batchPath))
            {
                MessageBox.Show(
                    "未找到启动脚本：" + batchPath,
                    "暖立方 NikkiCube",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = batchPath,
                    WorkingDirectory = startDirectory,
                    UseShellExecute = true,
                    WindowStyle = ProcessWindowStyle.Normal
                });
            }
            catch (Exception exception)
            {
                MessageBox.Show(
                    "启动失败：" + exception.Message,
                    "暖立方 NikkiCube",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }
    }
}
