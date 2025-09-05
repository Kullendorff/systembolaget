Set shell = CreateObject("WScript.Shell")

' Start MCP server hidden
shell.Run "cmd /c cd /d ""C:\systemet\mcp-server"" && npm start", 0, False

' Wait 3 seconds
WScript.Sleep 3000

' Start Discord bot hidden  
shell.Run "cmd /c cd /d ""C:\systemet\discord-bot"" && npm start", 0, False

' Show confirmation message
MsgBox "Wine services started successfully!" & vbCrLf & vbCrLf & _
       "Services running:" & vbCrLf & _
       "- MCP Server" & vbCrLf & _
       "- Discord Bot" & vbCrLf & vbCrLf & _
       "Use stop-wine-services.ps1 to stop.", vbInformation, "Wine Services"