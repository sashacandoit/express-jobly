"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for companies. */

class Company {
    /** Create a company (from data), update db, return new company data.
     *
     * data should be { handle, name, description, numEmployees, logoUrl }
     *
     * Returns { handle, name, description, numEmployees, logoUrl }
     *
     * Throws BadRequestError if company already in database.
     * */

    static async create({ handle, name, description, numEmployees, logoUrl }) {
        const duplicateCheck = await db.query(
            `SELECT handle
           FROM companies
           WHERE handle = $1`,
            [handle]);

        if (duplicateCheck.rows[0])
            throw new BadRequestError(`Duplicate company: ${handle}`);

        const result = await db.query(
            `INSERT INTO companies
           (handle, name, description, num_employees, logo_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING handle, name, description, num_employees AS "numEmployees", logo_url AS "logoUrl"`,
            [
                handle,
                name,
                description,
                numEmployees,
                logoUrl,
            ],
        );
        const company = result.rows[0];

        return company;
    }

    /** Find all companies - unfiltered
     * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
     * */

    // static async findAll() {
    //     const companiesRes = await db.query(
    //         `SELECT handle,
    //               name,
    //               description,
    //               num_employees AS "numEmployees",
    //               logo_url AS "logoUrl"
    //        FROM companies
    //        ORDER BY name`);
    //     return companiesRes.rows;
    // }



    /** Find all companies.
     * Filter by optional params: min-employees, max-employees, name (case-insensitive and partial matches)
     * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
     * */

    static async findAll(filters = {}) {
        let whereExpressions = [];
        let queryVals = [];
        const { minEmployees, maxEmployees, name } = filters;

        let query = `SELECT handle,
            name,
            description,
            num_employees AS "numEmployees",
            logo_url AS "logoUrl"
            FROM companies`
        
        // Make sure min-employees value is less than max-employees value
        if (minEmployees > maxEmployees) {
            throw new BadRequestError("MIN-employees cannot be greater than MAX-employees");
        }

        //Check for each possible param and add values to queryVals and value position to whereExpressions 
        if (minEmployees !== undefined) {
            queryVals.push(minEmployees);
            whereExpressions.push(`num_employees >= $${queryVals.length}`)
        }

        if (maxEmployees !== undefined) {
            queryVals.push(maxEmployees);
            whereExpressions.push(`num_employees <= $${queryVals.length}`)
        }

        if (name !== undefined) {
            queryVals.push(`%${name}%`);
            whereExpressions.push(`name ILIKE $${queryVals.length}`)
        }

        //join whereExpressions and add new WHERE expression string to query
        if (whereExpressions.length > 0) {
            query += " WHERE " + whereExpressions.join(" AND ");
        }

        // finish assembling query
        query += " ORDER BY name"

        const companiesRes = await db.query(query, queryVals);
        return companiesRes.rows;
    }



    /** Given a company handle, return data about company.
     *
     * Returns { handle, name, description, numEmployees, logoUrl, jobs }
     *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
     *
     * Throws NotFoundError if not found.
     **/

    static async get(handle) {
        const companyRes = await db.query(
            `SELECT handle,
                  name,
                  description,
                  num_employees AS "numEmployees",
                  logo_url AS "logoUrl"
           FROM companies
           WHERE handle = $1`,
            [handle]);

        const company = companyRes.rows[0];

        if (!company) throw new NotFoundError(`No company: ${handle}`);

        return company;
    }

    /** Update company data with `data`.
     *
     * This is a "partial update" --- it's fine if data doesn't contain all the
     * fields; this only changes provided ones.
     *
     * Data can include: {name, description, numEmployees, logoUrl}
     *
     * Returns {handle, name, description, numEmployees, logoUrl}
     *
     * Throws NotFoundError if not found.
     */

    static async update(handle, data) {
        const { setCols, values } = sqlForPartialUpdate(
            data,
            {
                numEmployees: "num_employees",
                logoUrl: "logo_url",
            });
        const handleVarIdx = "$" + (values.length + 1);

        const querySql = `UPDATE companies 
                      SET ${setCols} 
                      WHERE handle = ${handleVarIdx} 
                      RETURNING handle, 
                                name, 
                                description, 
                                num_employees AS "numEmployees", 
                                logo_url AS "logoUrl"`;
        const result = await db.query(querySql, [...values, handle]);
        const company = result.rows[0];

        if (!company) throw new NotFoundError(`No company: ${handle}`);

        return company;
    }

    /** Delete given company from database; returns undefined.
     *
     * Throws NotFoundError if company not found.
     **/

    static async remove(handle) {
        const result = await db.query(
            `DELETE
           FROM companies
           WHERE handle = $1
           RETURNING handle`,
            [handle]);
        const company = result.rows[0];

        if (!company) throw new NotFoundError(`No company: ${handle}`);
    }
}


module.exports = Company;
