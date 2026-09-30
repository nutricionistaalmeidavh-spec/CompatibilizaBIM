from __future__ import annotations
import os,sys

def rss_mb()->float|None:
    """Best-effort resident-memory metric without an extra dependency."""
    try:
        if sys.platform.startswith('win'):
            import ctypes
            from ctypes import wintypes
            class PMC(ctypes.Structure):
                _fields_=[('cb',wintypes.DWORD),('PageFaultCount',wintypes.DWORD),('PeakWorkingSetSize',ctypes.c_size_t),('WorkingSetSize',ctypes.c_size_t),('QuotaPeakPagedPoolUsage',ctypes.c_size_t),('QuotaPagedPoolUsage',ctypes.c_size_t),('QuotaPeakNonPagedPoolUsage',ctypes.c_size_t),('QuotaNonPagedPoolUsage',ctypes.c_size_t),('PagefileUsage',ctypes.c_size_t),('PeakPagefileUsage',ctypes.c_size_t)]
            counters=PMC();counters.cb=ctypes.sizeof(PMC)
            ok=ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.windll.kernel32.GetCurrentProcess(),ctypes.byref(counters),counters.cb)
            return round(counters.WorkingSetSize/1024/1024,1) if ok else None
        import resource
        value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        if sys.platform=='darwin':value/=1024
        return round(value/1024,1)
    except Exception:return None
