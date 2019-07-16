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

module.exports = (app, plugin) => {
  return {
    pgns: [ 127237, 129283, 129284, 127258 ],
    title: 'Autopilot Routing Data',
    optionKey: 'AUTOPILOTv2',
    keys: [
      'navigation.headingMagnetic',
      'navigation.headingTrue',
      'navigation.magneticVariation',
      'navigation.magneticVariationAgeOfService',
      'navigation.courseRhumbline.crossTrackError',
      'navigation.courseRhumbline.bearingTrackTrue',
      'navigation.courseRhumbline.bearingTrackMagnetic',
      'navigation.courseRhumbline.nextPoint.ID',
      'navigation.courseRhumbline.nextPoint.position',
      'navigation.courseRhumbline.nextPoint.bearingTrue',
      'navigation.courseRhumbline.nextPoint.distance',
      'navigation.courseRhumbline.previousPoint.ID',
      'steering.autopilot.target.headingTrue',
      'notifications.arrivalCircleEntered',
      'notifications.perpendicularPassed'
    ],
    callback: (headingMagnetic, headingTrue, magneticVariation, magneticVariationAgeOfService, XTE, bearingTrackTrue, bearingTrackMagnetic, nextPointID, nextPointPosition, nextPointBearingTrue, distance, previousPointID, apHeadingTrue, arrivalCircleEntered, perpendicularPassed) => {
      const validNextPointPosition = (nextPointPosition && typeof nextPointPosition === 'object' && nextPointPosition.hasOwnProperty('latitude') && nextPointPosition.hasOwnProperty('longitude'))
      const SID = 87
      const bearingTrack = bearingTrackTrue || bearingTrackMagnetic

      return [
        (!distance || !nextPointBearingTrue || !validNextPointPosition) ? null : {
          pgn: 129284,
          SID,
          'Distance to Waypoint': distance,
          'Course/Bearing reference': 0, // true
          'Perpendicular Crossed': perpendicularPassed === null ? 0 : 1, // 0 = No, 1 = Yes
          'Arrival Circle Entered': arrivalCircleEntered === null ? 0 : 1, // 0 = No, 1 = Yes
          'Calculation Type': 1, // rhumbline
          // 'ETA Time': -1, // Seconds since midnight
          // 'ETA Date': -1, // Days since January 1, 1970
          'Bearing, Origin to Destination Waypoint': bearingTrack,
          'Bearing, Position to Destination Waypoint': nextPointBearingTrue,
          'Origin Waypoint Number': previousPointID,
          'Destination Waypoint Number': nextPointID,
          'Destination Latitude': nextPointPosition.latitude,
          'Destination Longitude': nextPointPosition.longitude
          // 'Waypoint Closing Velocity': -1
        },
        (!apHeadingTrue || !headingTrue) ? null : {
          pgn: 127237,
          'Heading-To-Steer (Course)': apHeadingTrue,
          'Vessel Heading': headingTrue
        },
        !XTE ? null : {
          pgn: 129283, // XTE
          'XTE mode': 0, // Autonomous
          SID,
          XTE
        },
        (!magneticVariation || !magneticVariationAgeOfService) ? null : {
          pgn: 127258, // Magnetic variation
          SID,
          Source: 1, // Automatic Chart
          Variation: magneticVariation, // Variation with resolution 0.0001 in rad,
          'Age of service': Math.floor(magneticVariationAgeOfService / 86400000) // Days since epoch
        }
      ].filter(pgn => (pgn !== null)).map(pgn => {
        debug(`Sending PGN ${pgn.pgn}: ${JSON.stringify(pgn, null, 2)}`)
        return pgn
      })
    }
  }
}
