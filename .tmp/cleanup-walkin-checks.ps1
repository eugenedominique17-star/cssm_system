$taskProcesses = @(Get-CimInstance Win32_Process)
$taskRoots = @($taskProcesses | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*verify-walkin-browser.cjs*' })
function Stop-TaskTree([uint32]$taskId) {
  foreach ($taskChild in @($taskProcesses | Where-Object { $_.ParentProcessId -eq $taskId })) { Stop-TaskTree $taskChild.ProcessId }
  Stop-Process -Id $taskId -Force -ErrorAction SilentlyContinue
}
foreach ($taskRoot in $taskRoots) { Stop-TaskTree $taskRoot.ProcessId }
Write-Output ('Stopped owned browser-check processes: ' + $taskRoots.Count)
