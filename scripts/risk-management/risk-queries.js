/**
 * ServiceNow IRM Toolkit - Risk Management GlideRecord Scripts
 * ============================================================
 * Collection of production-ready GlideRecord scripts for Risk Management
 * Compatible with: ServiceNow Tokyo, Utah, Vancouver, Washington DC, Xanadu
 * 
 * Author: IRM Toolkit (Based on 20+ Years ServiceNow IRM Experience)
 * Usage: Run in Background Scripts, Business Rules, Scheduled Jobs, or Script Includes
 */

// =============================================================================
// SECTION 1: RISK REGISTER QUERIES
// =============================================================================

/**
 * Get all open risks with full details
 * Table: sn_risk_risk
 */
function getAllOpenRisks() {
    var risks = [];
    var gr = new GlideRecord('sn_risk_risk');
    gr.addQuery('state', 'open');
    gr.addQuery('active', true);
    gr.orderByDesc('residual_score');
    gr.query();

    while (gr.next()) {
        risks.push({
            sysId: gr.sys_id.toString(),
            number: gr.number.toString(),
            name: gr.name.toString(),
            category: gr.category.getDisplayValue(),
            likelihood: gr.likelihood.toString(),
            impact: gr.impact.toString(),
            inherentScore: gr.inherent_score.toString(),
            residualScore: gr.residual_score.toString(),
            owner: gr.owner.getDisplayValue(),
            state: gr.state.getDisplayValue(),
            riskStatement: gr.risk_statement.getDisplayValue()
        });
    }
    return risks;
}

/**
 * Get risks by category and score threshold
 * @param {string} category - Risk category (e.g., 'cybersecurity', 'operational')
 * @param {number} minScore - Minimum residual score
 */
function getRisksByCategoryAndScore(category, minScore) {
    var gr = new GlideRecord('sn_risk_risk');
    gr.addQuery('state', 'open');
    gr.addQuery('category', category);
    gr.addQuery('residual_score', '>=', minScore);
    gr.orderByDesc('residual_score');
    gr.query();

    var results = [];
    while (gr.next()) {
        results.push({
            number: gr.number.toString(),
            name: gr.name.toString(),
            residualScore: parseInt(gr.residual_score.toString()),
            owner: gr.owner.getDisplayValue()
        });
    }
    return results;
}

/**
 * Generate Risk Heatmap Data
 * Returns a 5x5 matrix with risk counts
 */
function generateRiskHeatmap() {
    var matrix = {};
    
    // Initialize 5x5 matrix
    for (var l = 1; l <= 5; l++) {
        for (var i = 1; i <= 5; i++) {
            matrix[l + '_' + i] = { count: 0, risks: [] };
        }
    }
    
    var gr = new GlideRecord('sn_risk_risk');
    gr.addQuery('state', 'open');
    gr.addQuery('active', true);
    gr.query();
    
    while (gr.next()) {
        var likelihood = gr.likelihood.toString();
        var impact = gr.impact.toString();
        var key = likelihood + '_' + impact;
        
        if (matrix[key]) {
            matrix[key].count++;
            matrix[key].risks.push({
                number: gr.number.toString(),
                name: gr.name.toString()
            });
        }
    }
    
    return matrix;
}

/**
 * Get Risks Exceeding Risk Appetite
 * Compares residual scores against defined risk appetite thresholds
 */
function getRisksExceedingAppetite() {
    var exceeding = [];
    
    var gr = new GlideRecord('sn_risk_risk');
    gr.addQuery('state', 'open');
    gr.addQuery('active', true);
    gr.query();
    
    while (gr.next()) {
        var appetite = new GlideRecord('sn_risk_risk_appetite');
        appetite.addQuery('category', gr.category);
        appetite.setLimit(1);
        appetite.query();
        
        if (appetite.next()) {
            var threshold = parseInt(appetite.threshold.toString());
            var residual = parseInt(gr.residual_score.toString());
            
            if (residual > threshold) {
                exceeding.push({
                    number: gr.number.toString(),
                    name: gr.name.toString(),
                    category: gr.category.getDisplayValue(),
                    residualScore: residual,
                    appetiteThreshold: threshold,
                    exceedance: residual - threshold,
                    owner: gr.owner.getDisplayValue()
                });
            }
        }
    }
    
    // Sort by exceedance (highest first)
    exceeding.sort(function(a, b) { return b.exceedance - a.exceedance; });
    return exceeding;
}

// =============================================================================
// SECTION 2: RISK ASSESSMENT SCRIPTS
// =============================================================================

/**
 * Create a Risk Assessment
 * @param {string} riskSysId - sys_id of the risk
 * @param {string} assessorSysId - sys_id of the assessor
 * @param {string} dueDate - Assessment due date (YYYY-MM-DD)
 */
function createRiskAssessment(riskSysId, assessorSysId, dueDate) {
    var assessment = new GlideRecord('sn_risk_risk_assessment');
    assessment.initialize();
    assessment.risk = riskSysId;
    assessment.assessor = assessorSysId;
    assessment.due_date = dueDate;
    assessment.state = 'open';
    assessment.assessment_type = 'annual'; // or 'triggered', 'periodic'
    
    var sysId = assessment.insert();
    gs.log('Created risk assessment: ' + assessment.number + ' for risk: ' + riskSysId);
    return sysId;
}

/**
 * Get Assessment Status Summary
 * Returns counts of assessments by state
 */
function getAssessmentStatusSummary() {
    var states = ['open', 'in_progress', 'pending_review', 'closed'];
    var summary = {};
    
    for (var i = 0; i < states.length; i++) {
        var agg = new GlideAggregate('sn_risk_risk_assessment');
        agg.addQuery('state', states[i]);
        agg.addAggregate('COUNT');
        agg.query();
        agg.next();
        summary[states[i]] = parseInt(agg.getAggregate('COUNT'));
    }
    
    return summary;
}

/**
 * Get Overdue Risk Assessments with Owner Details
 */
function getOverdueAssessments() {
    var gr = new GlideRecord('sn_risk_risk_assessment');
    gr.addQuery('state', 'IN', 'open,in_progress');
    gr.addQuery('due_date', '<', gs.nowDateTime());
    gr.orderBy('due_date');
    gr.query();
    
    var overdueList = [];
    while (gr.next()) {
        var daysOverdue = gs.dateDiff(gr.due_date + '', gs.nowDateTime(), true);
        overdueList.push({
            number: gr.number.toString(),
            riskName: gr.risk.getDisplayValue(),
            riskNumber: gr.risk.number.toString(),
            assessor: gr.assessor.getDisplayValue(),
            dueDate: gr.due_date.toString(),
            daysOverdue: parseInt(daysOverdue),
            state: gr.state.getDisplayValue()
        });
    }
    
    return overdueList;
}

// =============================================================================
// SECTION 3: KRI (KEY RISK INDICATOR) SCRIPTS
// =============================================================================

/**
 * Check all KRI thresholds and return breached KRIs
 */
function getBreachedKRIs() {
    var breached = [];
    
    var gr = new GlideRecord('sn_risk_kri');
    gr.addQuery('active', true);
    gr.query();
    
    while (gr.next()) {
        var currentValue = parseFloat(gr.value.toString() || 0);
        var threshold = parseFloat(gr.threshold.toString() || 0);
        var direction = gr.threshold_direction.toString(); // above_threshold, below_threshold
        
        var isBreached = false;
        if (direction === 'above_threshold' && currentValue > threshold) {
            isBreached = true;
        } else if (direction === 'below_threshold' && currentValue < threshold) {
            isBreached = true;
        }
        
        if (isBreached) {
            breached.push({
                name: gr.name.toString(),
                riskName: gr.risk.getDisplayValue(),
                currentValue: currentValue,
                threshold: threshold,
                direction: direction,
                trend: gr.trend.toString(),
                owner: gr.owner.getDisplayValue()
            });
        }
    }
    
    return breached;
}

/**
 * Update KRI value from external data source
 * @param {string} kriSysId - sys_id of the KRI
 * @param {number} newValue - New KRI value
 */
function updateKRIValue(kriSysId, newValue) {
    var kri = new GlideRecord('sn_risk_kri');
    if (kri.get(kriSysId)) {
        var previousValue = parseFloat(kri.value.toString() || 0);
        
        kri.previous_value = previousValue;
        kri.value = newValue;
        kri.last_updated = gs.nowDateTime();
        
        // Set trend
        if (newValue > previousValue) {
            kri.trend = 'increasing';
        } else if (newValue < previousValue) {
            kri.trend = 'decreasing';
        } else {
            kri.trend = 'stable';
        }
        
        // Check threshold
        var threshold = parseFloat(kri.threshold.toString());
        var direction = kri.threshold_direction.toString();
        
        if ((direction === 'above_threshold' && newValue > threshold) ||
            (direction === 'below_threshold' && newValue < threshold)) {
            kri.threshold_breach = true;
            // Fire event for notification
            gs.eventQueue('sn_risk.kri.threshold_breach', kri, gs.getUserID(), kri.risk + '');
        } else {
            kri.threshold_breach = false;
        }
        
        kri.update();
        gs.log('Updated KRI: ' + kri.name + ' | New Value: ' + newValue + ' | Previous: ' + previousValue);
        return true;
    }
    return false;
}

// =============================================================================
// SECTION 4: RISK TREATMENT & RESPONSE
// =============================================================================

/**
 * Get Risk Treatment Summary by Strategy
 */
function getRiskTreatmentSummary() {
    var strategies = ['accept', 'mitigate', 'transfer', 'avoid'];
    var summary = {};
    
    for (var i = 0; i < strategies.length; i++) {
        var strategy = strategies[i];
        var agg = new GlideAggregate('sn_risk_risk');
        agg.addQuery('state', 'open');
        agg.addQuery('treatment_strategy', strategy);
        agg.addAggregate('COUNT');
        agg.query();
        agg.next();
        summary[strategy] = parseInt(agg.getAggregate('COUNT'));
    }
    
    return summary;
}

/**
 * Get Overdue Risk Response Tasks
 */
function getOverdueResponseTasks() {
    var gr = new GlideRecord('sn_risk_risk_response_task');
    gr.addQuery('state', '!=', 'closed');
    gr.addQuery('due_date', '<', gs.nowDateTime());
    gr.orderBy('due_date');
    gr.query();
    
    var overdue = [];
    while (gr.next()) {
        overdue.push({
            number: gr.number.toString(),
            name: gr.name.toString(),
            riskName: gr.risk.getDisplayValue(),
            assignedTo: gr.assigned_to.getDisplayValue(),
            dueDate: gr.due_date.toString(),
            state: gr.state.getDisplayValue()
        });
    }
    
    return overdue;
}

// =============================================================================
// SECTION 5: REPORTING & ANALYTICS
// =============================================================================

/**
 * Generate Executive Risk Summary Report
 * Returns comprehensive risk metrics for board/executive reporting
 */
function generateExecutiveRiskSummary() {
    var report = {
        generatedOn: gs.nowDateTime().toString(),
        totalOpenRisks: 0,
        risksByRating: { critical: 0, high: 0, medium: 0, low: 0 },
        risksByCategory: {},
        avgResidualScore: 0,
        exceededAppetite: 0,
        topRisks: [],
        kpiSummary: {}
    };
    
    // Total open risks
    var total = new GlideAggregate('sn_risk_risk');
    total.addQuery('state', 'open');
    total.addQuery('active', true);
    total.addAggregate('COUNT');
    total.query();
    total.next();
    report.totalOpenRisks = parseInt(total.getAggregate('COUNT'));
    
    // Risks by rating
    var ratings = [
        { name: 'critical', minScore: 16, maxScore: 25 },
        { name: 'high', minScore: 10, maxScore: 15 },
        { name: 'medium', minScore: 5, maxScore: 9 },
        { name: 'low', minScore: 1, maxScore: 4 }
    ];
    
    for (var i = 0; i < ratings.length; i++) {
        var r = ratings[i];
        var agg = new GlideAggregate('sn_risk_risk');
        agg.addQuery('state', 'open');
        agg.addQuery('residual_score', '>=', r.minScore);
        agg.addQuery('residual_score', '<=', r.maxScore);
        agg.addAggregate('COUNT');
        agg.query();
        agg.next();
        report.risksByRating[r.name] = parseInt(agg.getAggregate('COUNT'));
    }
    
    // Top 5 risks
    var top5 = new GlideRecord('sn_risk_risk');
    top5.addQuery('state', 'open');
    top5.orderByDesc('residual_score');
    top5.setLimit(5);
    top5.query();
    
    while (top5.next()) {
        report.topRisks.push({
            number: top5.number.toString(),
            name: top5.name.toString(),
            residualScore: parseInt(top5.residual_score.toString()),
            category: top5.category.getDisplayValue(),
            owner: top5.owner.getDisplayValue()
        });
    }
    
    return report;
}

/**
 * Risk Trend Analysis - Compare current vs prior period
 * @param {number} daysBack - Number of days to look back for comparison
 */
function analyzeRiskTrend(daysBack) {
    var priorDate = gs.daysAgo(daysBack);
    
    // Current state
    var currentCritical = new GlideAggregate('sn_risk_risk');
    currentCritical.addQuery('state', 'open');
    currentCritical.addQuery('residual_score', '>=', 16);
    currentCritical.addAggregate('COUNT');
    currentCritical.query();
    currentCritical.next();
    var currentCount = parseInt(currentCritical.getAggregate('COUNT'));
    
    // Prior period - risks that were created before priorDate
    var priorCritical = new GlideAggregate('sn_risk_risk');
    priorCritical.addQuery('sys_created_on', '<=', priorDate);
    priorCritical.addQuery('residual_score', '>=', 16);
    priorCritical.addQuery('state', 'IN', 'open,closed');
    priorCritical.addAggregate('COUNT');
    priorCritical.query();
    priorCritical.next();
    var priorCount = parseInt(priorCritical.getAggregate('COUNT'));
    
    var change = currentCount - priorCount;
    var trend = change > 0 ? 'INCREASING' : (change < 0 ? 'DECREASING' : 'STABLE');
    
    gs.log('Risk Trend Analysis (' + daysBack + ' days):');
    gs.log('Current Critical Risks: ' + currentCount);
    gs.log('Prior Period: ' + priorCount);
    gs.log('Change: ' + (change > 0 ? '+' : '') + change + ' (' + trend + ')');
    
    return { current: currentCount, prior: priorCount, change: change, trend: trend };
}

// =============================================================================
// SECTION 6: UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate Risk Score from Likelihood and Impact
 * @param {number} likelihood - 1-5
 * @param {number} impact - 1-5
 * @returns {object} - Score and rating
 */
function calculateRiskScore(likelihood, impact) {
    var score = likelihood * impact;
    var rating;
    
    if (score >= 16) rating = 'critical';
    else if (score >= 10) rating = 'high';
    else if (score >= 5) rating = 'medium';
    else rating = 'low';
    
    return { score: score, rating: rating };
}

/**
 * Find Orphaned Risks (risks with no owner or inactive owner)
 */
function findOrphanedRisks() {
    var orphaned = [];
    
    // Risks with no owner
    var noOwner = new GlideRecord('sn_risk_risk');
    noOwner.addQuery('state', 'open');
    noOwner.addQuery('owner', '');
    noOwner.query();
    
    while (noOwner.next()) {
        orphaned.push({ number: noOwner.number.toString(), reason: 'No owner assigned' });
    }
    
    // Risks with inactive owner
    var inactiveOwner = new GlideRecord('sn_risk_risk');
    inactiveOwner.addQuery('state', 'open');
    inactiveOwner.addQuery('owner.active', false);
    inactiveOwner.query();
    
    while (inactiveOwner.next()) {
        orphaned.push({ 
            number: inactiveOwner.number.toString(), 
            reason: 'Owner inactive: ' + inactiveOwner.owner.getDisplayValue() 
        });
    }
    
    return orphaned;
}

/**
 * Bulk Update Risk Owner
 * @param {string} fromUserSysId - Previous owner
 * @param {string} toUserSysId - New owner
 */
function bulkTransferRiskOwnership(fromUserSysId, toUserSysId) {
    var gr = new GlideRecord('sn_risk_risk');
    gr.addQuery('state', 'open');
    gr.addQuery('owner', fromUserSysId);
    gr.query();
    
    var count = 0;
    while (gr.next()) {
        gr.owner = toUserSysId;
        gr.update();
        count++;
    }
    
    gs.log('Transferred ' + count + ' risks to new owner: ' + new GlideRecord('sys_user').get(toUserSysId));
    return count;
}

// =============================================================================
// MAIN EXECUTION (for Background Script testing)
// =============================================================================

// Uncomment to test individual functions:
// var summary = generateExecutiveRiskSummary();
// gs.log(JSON.stringify(summary, null, 2));

// var heatmap = generateRiskHeatmap();
// gs.log('Heatmap generated with ' + Object.keys(heatmap).length + ' cells');

// var breachedKRIs = getBreachedKRIs();
// gs.log('Breached KRIs: ' + breachedKRIs.length);

gs.log('Risk Management Scripts loaded successfully');
