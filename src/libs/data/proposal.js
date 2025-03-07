import compareVersions from 'compare-versions'
import ProposalTally from './proposal-tally'

export default class Proposal {
  constructor() {
    this.element = null

    this.id = 0
    this.status = 1
    this.type = '-'
    this.title = '-'
    this.description = '-'
    this.tally = new ProposalTally()
    this.submit_time = ' - '
    this.voting_end_time = '0000-00-00'
    this.voting_start_time = '-'
    this.total_deposit = '-'
    this.contents = null
  }

  init(element, total) {
    this.element = element

    this.id = element.id
    this.status = element.status
    this.type = element.content.type
    this.title = element.content.value.title
    this.description = element.content.value.description
    this.tally = new ProposalTally().init(element.final_tally_result, total)
    this.submit_time = element.submit_time
    this.voting_end_time = element.voting_end_time
    this.voting_start_time = element.voting_start_time
    // eslint-disable-next-line prefer-destructuring
    this.total_deposit = element.total_deposit[0]
    this.contents = element.content.value
    return this
  }

  hello() {
    return this.title
  }

  updateTally(newTally) {
    this.tally = newTally
  }

  versionFixed(ver) {
    if (compareVersions(ver, '0.40') >= 0) {
      // do nothing
    } else if (compareVersions(ver, '0.30') >= 0) {
      switch (this.element.proposal_status) {
        case 'Passed':
          this.status = 3
          break
        case 'VotingPeriod':
          this.status = 2
          break
        case 'Rejected':
          this.status = 4
          break
        default:
          this.status = 1
      }
    }
    if (String(this.status).indexOf('PASSED') > -1) {
      this.status = 3
    }
  }
}
