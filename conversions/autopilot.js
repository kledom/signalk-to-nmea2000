// const { DateTime } = require('luxon')
const debug = require('debug')('signalk-to-nmea2000/conversions/autopilot')


/**
 * APB: 127237 (Heading/Track control) X, 129283 (Cross Track Error) X, 129284 (Navigation Data) X
 * RMC: 127258 (Magnetic Variation) X
 *
 * One also should enable conversions for (if not present on network):
 * - systemTime
 * - cogSOG
 * - heading
 * - gps
 */

var SID = 0

module.exports = (app, plugin) => {
  return {
    pgns: [ 127237, 129283, 129284, 127258 ],
    title: 'Autopilot Routing Data (127237, 128283, 129284, 127258)',
    optionKey: 'AUTOPILOTv2',
    keys: [
      'navigation.headingMagnetic',
      'navigation.headingTrue',
      'navigation.magneticVariation',
      'navigation.magneticVariationAgeOfService',
      'navigation.courseRhumbline.crossTrackError',
      'navigation.courseRhumbline.bearingTrackTrue',
      'navigation.courseRhumbline.bearingTrackMagnetic',
      'navigation.courseRhumbline.nextPoint',
      'navigation.courseRhumbline.nextPoint.ID',
      'navigation.courseRhumbline.nextPoint.bearingTrue',
      'navigation.courseRhumbline.nextPoint.bearingMagnetic',
      'navigation.courseRhumbline.nextPoint.distance',
      'navigation.courseRhumbline.previousPoint.ID',
      'steering.autopilot.target.headingTrue',
      'notifications.arrivalCircleEntered',
      'notifications.perpendicularPassed'
    ],
    callback: (
      headingMagnetic,
      headingTrue,
      magneticVariation,
      magneticVariationAgeOfService,
      XTE,
      bearingTrackTrue,
      bearingTrackMagnetic,
      nextPointPosition,
      nextPointID,
      nextPointBearingTrue,
      nextPointBearingMagnetic,
      distance,
      previousPointID,
      apHeadingTrue,
      arrivalCircleEntered,
      perpendicularPassed
    ) => {
      const validNextPointPosition = (nextPointPosition && typeof nextPointPosition === 'object' && nextPointPosition.hasOwnProperty('latitude') && nextPointPosition.hasOwnProperty('longitude'))
      const bearingTrack = bearingTrackTrue === null ? bearingTrackMagnetic : bearingTrackTrue
      let bearingRef = 0

      if (bearingTrackTrue === null && bearingTrackMagnetic !== null) {
        bearingRef = 1
      }

      const navigationDataPGN = {
        pgn: 129284,
        priority: 3,
        'SID': SID,
        // 'ETA Time': -1, // Seconds since midnight
        // 'ETA Date': -1, // Days since January 1, 1970
      }

      if (validNextPointPosition === true) {
        navigationDataPGN['Distance to Waypoint'] = distance || 0,
        navigationDataPGN['Course/Bearing reference'] = bearingRef || 0
        navigationDataPGN['Destination Latitude'] = nextPointPosition.latitude
        navigationDataPGN['Destination Longitude'] = nextPointPosition.longitude
        navigationDataPGN['Perpendicular Crossed'] = perpendicularPassed === null ? 0 : 1 // 0 = No, 1 = Yes
        navigationDataPGN['Calculation Type'] = 1, // rhumbline
        navigationDataPGN['Arrival Circle Entered'] = arrivalCircleEntered === null ? 0 : 1 // 0 = No, 1 = Yes
        navigationDataPGN['Waypoint Closing Velocity'] = 0.2

        if (nextPointBearingTrue !== null || nextPointBearingMagnetic !== null) {
          navigationDataPGN['Bearing, Position to Destination Waypoint'] = nextPointBearingTrue === null ? nextPointBearingMagnetic : nextPointBearingTrue
        }
  
        if (bearingTrack !== null) {
          navigationDataPGN['Bearing, Origin to Destination Waypoint'] = bearingTrack
        }
  
        if (previousPointID !== null) {
          navigationDataPGN['Origin Waypoint Number'] = previousPointID
        }
  
        if (nextPointID !== null) {
          navigationDataPGN['Destination Waypoint Number'] = nextPointID
        }
      }

      const navigationInfoPGN = {
        pgn: 129285,
        priority: 7,
        'Supplementary Route/WP data available': 1
      }

      const headingToSteerPGN = (!apHeadingTrue || headingTrue === null) ? null : {
        pgn: 127237,
        // 'Heading-To-Steer (Course)': apHeadingTrue,
        // 'Vessel Heading': headingTrue === null ? headingMagnetic : headingTrue,
        'Rudder Limit Exceeded': 0, // 0 = No, 1 = Yes
        'Off-Heading Limit Exceeded': 0, // 0 = No, 1 = Yes
        'Override': 0, // 0 = No, 1 = Yes
        'Steering Mode': 0, // 0 = Main Steering, 1 = Non-Follow-up Device, 10 = Follow-up Device, 11 = Heading Control Standalone, 100 = Heading Control, 101 = Track Control
        // 'Turn Mode': -1,
        'Heading Reference': 0, // 0 = True, 1 = Magnetic, 2 = Error, 3 = Null
        'Rudder Limit': 0.436332, // 25° (rad)
        'Off-Heading Limit': 0.349066 // 20° (rad)
      }

      const crossTrackErrorPGN = {
        pgn: 129283, // XTE
        priority: 3,
        'XTE mode': 0, // Autonomous
        'Navigation Terminated': 0,
        'SID': SID,
      }

      if (XTE !== null) {
        crossTrackErrorPGN['XTE'] = XTE
      }

      const magneticVariationPGN = {
        pgn: 127258, // Magnetic variation
        priority: 7,
        'SID': SID,
        // 'Source': 1, // Automatic Chart
        'Variation': magneticVariation, // Variation with resolution 0.0001 in rad,
        //'Age of service': Math.floor((magneticVariationAgeOfService !== null ? magneticVariationAgeOfService : 0) / 86400000) // Days since epoch
      }

      SID = (SID + 1) % 250

      return [
        magneticVariationPGN,
        crossTrackErrorPGN,
        navigationDataPGN,
        navigationInfoPGN
        // headingToSteerPGN,
      ].filter(pgn => (pgn !== null)).map(pgn => {
        debug(`Sending PGN ${pgn.pgn}: ${JSON.stringify(pgn, null, 2)}`)
        return pgn
      })
    }
  }
}
