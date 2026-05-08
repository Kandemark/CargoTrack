@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup script for Windows (CMD)
@REM ----------------------------------------------------------------------------

@if "%DEBUG%"=="" @echo off
@setlocal

set "MAVEN_PROJECTBASEDIR=%~dp0"
set "WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar"
set "WRAPPER_PROPERTIES=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties"

if not exist "%WRAPPER_JAR%" (
    echo ERROR: maven-wrapper.jar not found at %WRAPPER_JAR%
    echo Run: powershell -Command "Invoke-WebRequest -Uri https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar -OutFile '%WRAPPER_JAR%'"
    exit /b 1
)

set "MAVEN_OPTS=-Xmx1024m -XX:MaxMetaspaceSize=256m %MAVEN_OPTS%"
java -Dmaven.multiModuleProjectDirectory="%MAVEN_PROJECTBASEDIR%" -cp "%WRAPPER_JAR%" -DwrapperProperties="%WRAPPER_PROPERTIES%" org.apache.maven.wrapper.MavenWrapperMain %*

@endlocal
