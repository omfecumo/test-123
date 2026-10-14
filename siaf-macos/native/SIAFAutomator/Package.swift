// swift-tools-version:5.7
// Auxiliar nativo de «SIAF Control y Automatización». Se compila en un Mac con Xcode 14+ (Swift 5.7+):
//   swift build -c release --arch arm64 --arch x86_64
// El ejecutable resultante se copia a SIAF.app/Contents/Resources/bin/siaf-automator (ver scripts/build-automator.sh).
import PackageDescription

let package = Package(
    name: "SIAFAutomator",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "siaf-automator",
            path: "Sources/siaf-automator",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("ApplicationServices"),
                .linkedFramework("Carbon"),
            ]
        ),
    ]
)
