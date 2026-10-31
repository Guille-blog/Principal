# Ingeniería inversa con Rea

| Carpeta       | Contenido                                               | En git |
| ------------- | ------------------------------------------------------- | ------ |
| `objetivos/`  | Binarios, instaladores, APK y descargas a analizar       | No     |
| `trabajo/`    | Salidas intermedias de Rea (JSON de evidencia, pseudocódigo) | No |
| `informes/`   | Conclusiones con evidencia y limitaciones               | Sí     |

El entorno (Rea y Ghidra) se instala solo al abrir cada sesión cloud; ver
`CLAUDE.md` y `.claude/rea/`.

Uso manual desde terminal:

```bash
rea doctor                                  # estado de Rea y de Ghidra
rea analyze <binario> --provider ghidra     # visión general de un ejecutable
rea analyze-javascript-application <dir|.asar> --json
rea --help
```
