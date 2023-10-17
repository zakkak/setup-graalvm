import * as c from './constants'
import {downloadExtractAndCacheJDK, getLatestRelease, getMatchingTags} from './utils'
import {downloadTool} from '@actions/tool-cache'
import {gt as semverGt, valid as semverValid} from 'semver'

const MANDREL_REPO = 'mandrel'
const MANDREL_TAG_PREFIX = c.MANDREL_NAMESPACE
const MANDREL_DL_BASE = 'https://github.com/graalvm/mandrel/releases/download'

export async function setUpMandrel(
  graalvmVersion: string,
  javaVersion: string
): Promise<string> {
  const mandrelVersion = graalvmVersion.substring(
    c.MANDREL_NAMESPACE.length,
    graalvmVersion.length
  )

  let mandrelHome
  switch (mandrelVersion) {
    case 'latest':
      mandrelHome = await setUpMandrelLatest(javaVersion)
      break
    default:
      mandrelHome = await setUpMandrelRelease(mandrelVersion, javaVersion)
      break
  }

  return mandrelHome
}

async function setUpMandrelLatest(javaVersion: string): Promise<string> {
  const latestRelease = await getLatestRelease(MANDREL_REPO)
  const tag_name = latestRelease.tag_name
  if (tag_name.startsWith(MANDREL_TAG_PREFIX)) {
    const latestVersion = tag_name.substring(
      MANDREL_TAG_PREFIX.length,
      tag_name.length
    )
    return setUpMandrelRelease(latestVersion, javaVersion)
  }
  throw new Error(`Could not find latest Mandrel release: ${tag_name}`)
}

async function setUpMandrelRelease(
  version: string,
  javaVersion: string
): Promise<string> {
  const dotsCount = version.split('.').length - 1
  if (dotsCount < 3) {
    version = await findLatestMandrelVersion(version)
  }

  const identifier = determineMandrelIdentifier(version, javaVersion)
  const downloadUrl = `${MANDREL_DL_BASE}/${MANDREL_TAG_PREFIX}${version}/${identifier}${c.GRAALVM_FILE_EXTENSION}`
  const toolName = determineToolName(javaVersion)
  return downloadExtractAndCacheJDK(
    async () => downloadTool(downloadUrl),
    toolName,
    version
  )
}

async function findLatestMandrelVersion(
  versionPrefix: string
): Promise<string> {
  const matchingRefs = await getMatchingTags(
    `${MANDREL_TAG_PREFIX}-${versionPrefix}`
  )
  const lowestNonExistingVersion = '0.0.1'
  let highestVersion = lowestNonExistingVersion
  const versionNumberStartIndex = `refs/tags/${MANDREL_TAG_PREFIX}`.length
  for (const matchingRef of matchingRefs) {
    // Mandrel tags are of the form 'mandrel-21.3.0.0-Final'
    const currentVersion = matchingRef.split('-')[1]
    if (
      semverValid(currentVersion) &&
      semverGt(currentVersion, highestVersion)
    ) {
      highestVersion = currentVersion
    }
  }
  if (highestVersion === lowestNonExistingVersion) {
    throw new Error(
      `Unable to find the latest Mandrel version starting with '${versionPrefix}'. Please make sure version is set correctly. ${c.ERROR_HINT}`
    )
  }
  return highestVersion
}


function determineMandrelIdentifier(
  version: string,
  javaVersion: string
): string {
  return `mandrel-java${javaVersion}-${c.GRAALVM_PLATFORM}-${c.GRAALVM_ARCH}-${version}`
}

function determineToolName(javaVersion: string): string {
  return `mandrel-java${javaVersion}-${c.GRAALVM_PLATFORM}`
}
